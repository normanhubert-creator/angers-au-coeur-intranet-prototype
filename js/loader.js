(function(){'use strict';
  performance.mark('aac-shell-visible');
  var debug=new URL(location.href).searchParams.get('debug')==='1';
  window.AAC_DEBUG=debug;
  fetch('templates.html',{credentials:'same-origin',cache:'no-cache'}).then(function(response){
    if(!response.ok)throw new Error('TEMPLATES_'+response.status);return response.text();
  }).then(function(markup){
    var host=document.createElement('div');host.hidden=true;host.id='page-templates';host.innerHTML=markup;document.body.append(host);
    performance.mark('aac-templates-ready');
    var script=document.createElement('script');script.src='js/app.js';script.defer=true;document.body.append(script);
  }).catch(function(){
    var main=document.getElementById('app-main');main.replaceChildren();
    var section=document.createElement('section'),title=document.createElement('h1'),message=document.createElement('p');
    section.className='message card';title.textContent='Chargement indisponible';message.textContent='Le prototype n’a pas pu être chargé. Actualisez la page.';
    section.append(title,message);main.append(section);
  });
})();
