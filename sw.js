/* 镜读 LensRead — service worker
   Everything the app needs is same-origin: the shell plus /vendor.
   Bump CACHE_VERSION on every deploy: lensread-<timestamp>. */
var CACHE_VERSION = 'lensread-v3.6.0-20260731';

/* Precached on install — the minimum to boot and read Chinese + English.
   The non-SIMD core and chi_tra are fetched on demand and cached then. */
var SHELL = [
  './',
  './index.html',
  './vendor/tesseract.min.js',
  './vendor/worker.min.js',
  './vendor/tesseract-core-simd-lstm.wasm.js',
  './vendor/chi_sim.traineddata.gz',
  './vendor/eng.traineddata.gz'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function(c){
      /* one at a time: a farm connection drops a parallel burst of 4MB files */
      return SHELL.reduce(function(chain, u){
        return chain.then(function(){
          return c.add(new Request(u, { cache:'reload' })).catch(function(){ /* keep going */ });
        });
      }, Promise.resolve());
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        return k === CACHE_VERSION ? null : caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch(err){ return; }
  if(url.origin !== self.location.origin) return;   /* nothing else is ours */

  /* engine assets are immutable for a given deploy: cache-first, no revalidation */
  if(url.pathname.indexOf('/vendor/') >= 0){
    e.respondWith(
      caches.open(CACHE_VERSION).then(function(c){
        return c.match(req).then(function(hit){
          if(hit) return hit;
          return fetch(req).then(function(res){
            if(res && res.ok) c.put(req, res.clone());
            return res;
          });
        });
      })
    );
    return;
  }

  /* the app shell: network-first so a redeploy is picked up, cache as fallback */
  e.respondWith(
    fetch(req).then(function(res){
      var copy = res.clone();
      caches.open(CACHE_VERSION).then(function(c){ c.put(req, copy); }).catch(function(){});
      return res;
    }).catch(function(){
      return caches.match(req).then(function(hit){
        return hit || caches.match('./index.html');
      });
    })
  );
});
