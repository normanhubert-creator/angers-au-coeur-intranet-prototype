(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.Transport=api;
})(typeof window!=='undefined'?window:globalThis,function(){'use strict';
  var VERSION=1,REQUEST='AAC_BRIDGE_REQUEST',RESPONSE='AAC_BRIDGE_RESPONSE',READY='AAC_BRIDGE_READY';
  var frame=null,bridgeSource=null,bridgeOrigin='',channel='',readyPromise=null,pending=new Map(),backendCalls=[];

  function config(){return window.AAC_CONFIG||{};}
  function correlationId(){
    if(window.crypto&&typeof window.crypto.randomUUID==='function')return window.crypto.randomUUID();
    var bytes=new Uint8Array(16);window.crypto.getRandomValues(bytes);
    return Array.from(bytes,function(value){return value.toString(16).padStart(2,'0');}).join('');
  }
  function publicError(value,fallback){
    var error=new Error(value&&value.message||fallback||'Le service est temporairement indisponible.');
    error.code=value&&value.code||'TRANSPORT_ERROR';return error;
  }
  function validMessage(event,expectedSource,expectedOrigin){
    return Boolean(event&&event.source===expectedSource&&event.origin===expectedOrigin&&event.data&&event.data.version===VERSION);
  }
  function allowedBridgeOrigin(origin){
    try{
      var url=new URL(String(origin||''));
      return url.protocol==='https:'&&url.port===''&&/^[a-z0-9-]+-script\.googleusercontent\.com$/.test(url.hostname);
    }catch(error){return false;}
  }
  function bridgeUrl(channelId){
    var cfg=config();
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(cfg.backendUrl||''))){
      throw publicError({code:'TRANSPORT_NOT_CONFIGURED',message:'Le service prototype n’est pas encore configuré.'});
    }
    var url=new URL(cfg.backendUrl);url.searchParams.set('view','bridge');url.searchParams.set('channel',channelId);return url.toString();
  }
  function init(){
    if(readyPromise)return readyPromise;
    readyPromise=new Promise(function(resolve,reject){
      var cfg=config(),timer,ready=false;
      frame=document.getElementById('aac-bridge');
      if(!frame)return reject(publicError(null,'Le canal sécurisé est indisponible.'));
      frame.setAttribute('sandbox','allow-scripts allow-same-origin');
      frame.setAttribute('referrerpolicy','no-referrer');
      channel=correlationId();
      function onMessage(event){
        if(!event||!event.data||event.data.version!==VERSION||event.data.channel!==channel)return;
        var message=event.data;
        if(message.type===READY){
          if(bridgeSource||!event.source||!allowedBridgeOrigin(event.origin))return;
          bridgeSource=event.source;bridgeOrigin=event.origin;
          ready=true;clearTimeout(timer);resolve(true);return;
        }
        if(event.source!==bridgeSource||event.origin!==bridgeOrigin)return;
        if(message.type!==RESPONSE||typeof message.correlationId!=='string')return;
        var request=pending.get(message.correlationId);if(!request)return;
        pending.delete(message.correlationId);clearTimeout(request.timer);
        request.metric.duration=Math.round(performance.now()-request.metric.startedAt);
        request.metric.status=message.ok?'ok':'error';
        if(message.ok)request.resolve(message.value);
        else request.reject(publicError(message.error));
      }
      window.addEventListener('message',onMessage);
      timer=setTimeout(function(){
        if(ready)return;readyPromise=null;reject(publicError({code:'TRANSPORT_TIMEOUT',message:'Le service met trop de temps à répondre. Réessayez.'}));
      },Number(cfg.transportTimeoutMs)||30000);
      frame.src=bridgeUrl(channel);
    });
    return readyPromise;
  }
  function call(method){
    var args=Array.prototype.slice.call(arguments,1),cfg=config();
    if(window.__AAC_TRANSPORT_MOCK__)return Promise.resolve().then(function(){return window.__AAC_TRANSPORT_MOCK__(method,args);});
    return init().then(function(){return new Promise(function(resolve,reject){
      var id=correlationId(),metric={method:method,correlationId:id,startedAt:performance.now(),duration:null,status:'pending'};
      backendCalls.push(metric);
      var timer=setTimeout(function(){pending.delete(id);metric.duration=Math.round(performance.now()-metric.startedAt);metric.status='timeout';reject(publicError({code:'TRANSPORT_TIMEOUT',message:'Le service met trop de temps à répondre. Réessayez.'}));},Number(cfg.transportTimeoutMs)||30000);
      pending.set(id,{resolve:resolve,reject:reject,timer:timer,metric:metric});
      bridgeSource.postMessage({type:REQUEST,version:VERSION,channel:channel,correlationId:id,method:method,args:args},bridgeOrigin);
    });});
  }
  function metrics(){return backendCalls.map(function(item){return Object.assign({},item,{startedAt:Math.round(item.startedAt)});});}
  function resetForTests(){pending.forEach(function(item){clearTimeout(item.timer);});pending.clear();backendCalls=[];frame=null;bridgeSource=null;bridgeOrigin='';channel='';readyPromise=null;}
  return Object.freeze({call:call,init:init,metrics:metrics,validMessage:validMessage,allowedBridgeOrigin:allowedBridgeOrigin,constants:Object.freeze({VERSION:VERSION,REQUEST:REQUEST,RESPONSE:RESPONSE,READY:READY}),_resetForTests:resetForTests});
});
