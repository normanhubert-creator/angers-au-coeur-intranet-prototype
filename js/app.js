(function(){'use strict';
  // ÉTAT GLOBAL
  var SESSION_KEY='aac_prototype_session_v1',
      ROUTE_PATHS={home:'accueil',contributions:'mes-contributions',poles:'poles',ideas:'idees',pole:'pole',subject:'sujet',referent:'referent','profile/security':'compte','admin/registrations':'admin','admin/registration':'admin/demande'},
      PATH_ROUTES={accueil:'home','mes-contributions':'contributions',poles:'poles',idees:'ideas',pole:'pole',sujet:'subject',referent:'referent',compte:'profile/security',admin:'admin/registrations','admin/demande':'admin/registration'},
      state={
        user:null,
        home:null,
        navigation:[],
        route:'login',
        poleId:'',
        subjectId:'',
        registrationId:'',
        renderStarted:0,
        renderMetrics:[]
      };

  // ÉLÉMENTS DOM
  var main=document.getElementById('app-main'),
      nav=document.getElementById('main-nav'),
      account=document.getElementById('account'),
      toast=document.getElementById('toast'),
      menuBtn=document.querySelector('.menu-btn');

  // FONCTIONS UTILITAIRES
  function token(){return sessionStorage.getItem(SESSION_KEY)||'';}
  function setToken(value){if(value)sessionStorage.setItem(SESSION_KEY,value);else sessionStorage.removeItem(SESSION_KEY);}

  function api(method){var args=Array.prototype.slice.call(arguments,1);return Transport.call.apply(Transport,[method].concat(args));}

  function result(value){if(!value||value.ok===false){var error=new Error(value&&value.message||'Une erreur est survenue.');error.code=value&&value.code||'';error.route=value&&value.route||'';throw error;}return value.data!==undefined?value.data:value;}

  function el(tag,className,text){var node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=String(text);return node;}

  function empty(container,text){container.replaceChildren(el('p','empty',text));}

  function notice(text){toast.textContent=text;toast.classList.add('show');setTimeout(function(){toast.classList.remove('show');},2800);}

  function alertOf(root,text,success){var box=root.querySelector('.alert');if(box){box.textContent=text||'';box.classList.toggle('success',Boolean(success));}}

  function busy(button,on){if(button)button.disabled=on;}

  function formatDate(value){if(!value)return'';var date=new Date(value);return isNaN(date.getTime())?String(value):new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium'}).format(date);}

  function formData(form){return Object.fromEntries(new FormData(form).entries());}

  function publicRoute(route){return['login','register','registration-sent','verify-email','pending-approval','forgot-password','reset-password','activate-membership','access-status'].indexOf(route)>=0;}

  function hashParts(){var raw=String(location.hash||'').replace(/^#\/?/,'');var index=raw.indexOf('?');return{path:(index<0?raw:raw.slice(0,index)).replace(/^\/+|\/+$/g,''),params:new URLSearchParams(index<0?'':raw.slice(index+1))};}

  function params(){var combined=new URL(location.href).searchParams,hash=hashParts().params;hash.forEach(function(value,key){combined.set(key,value);});return combined;}

  function initialRoute(){var hash=hashParts(),legacy=new URL(location.href).searchParams.get('action');return PATH_ROUTES[hash.path]||legacy||hash.path||'login';}

  function linkToken(){var value=String(window.AAC_LINK_TOKEN||'');window.AAC_LINK_TOKEN='';return value||params().get('token')||'';}

  function routeData(){var p=params();if(p.get('pole'))state.poleId=p.get('pole');if(p.get('subject'))state.subjectId=p.get('subject');if(p.get('registration'))state.registrationId=p.get('registration');}

  function urlFor(route,extra){var path=ROUTE_PATHS[route]||route,query=new URLSearchParams();extra=extra||{};Object.keys(extra).forEach(function(key){if(extra[key])query.set(key,extra[key]);});return '#/'+path+(query.toString()?'?'+query.toString():'');}

  function skeleton(container,count){if(!container)return;container.replaceChildren();container.setAttribute('aria-busy','true');for(var index=0;index<(count||3);index++){var item=el('div','skeleton-card');item.setAttribute('aria-hidden','true');item.append(el('span','skeleton skeleton-line'),el('span','skeleton skeleton-line short'),el('span','skeleton skeleton-block'));container.append(item);}}

  function skeletonize(route){var selectors={home:['#home-new-items','#home-contributions'],contributions:['#contributions-list'],poles:['#my-poles-list','#available-poles-list'],ideas:['#ideas-list'],pole:['#pole-ideas','#pole-subjects'],subject:['#subject-comments'],referent:['#referent-ideas','#referent-subjects'],'admin/registrations':['#registrations-list','#accounts-list']}[route]||[];selectors.forEach(function(selector){skeleton(document.querySelector(selector),selector.indexOf('poles')>=0?2:3);});}

  function renderDone(route){state.renderMetrics.push({route:route,duration:Math.round(performance.now()-state.renderStarted)});if(state.renderMetrics.length>20)state.renderMetrics.shift();Array.prototype.forEach.call(main.querySelectorAll('[aria-busy="true"]'),function(node){node.removeAttribute('aria-busy');});refreshDebug();}

  function refreshDebug(){if(!window.AAC_DEBUG)return;var panel=document.getElementById('debug-panel'),navigation=performance.getEntriesByType('navigation')[0],calls=Transport.metrics();if(!panel)return;panel.hidden=false;panel.replaceChildren(el('strong','','Diagnostic prototype'),el('span','',navigation?'Navigation : '+Math.round(navigation.duration)+' ms':'Navigation : en cours'),el('span','',calls.length+' appel(s) backend'));state.renderMetrics.slice(-6).forEach(function(item){panel.append(el('span','',item.route+' : '+item.duration+' ms'));});calls.slice(-8).forEach(function(item){panel.append(el('span','',item.method+' : '+(item.duration===null?'…':item.duration+' ms')+' ['+item.status+']'));});}

  function getIdeaStatusLabel(idea){return String(idea&&idea.statut_libelle||idea&&idea.statut||'');}

  function getContributionStatusLabel(item){return String(item&&item.status_label||item&&item.status||'');}

  // RENDU DE LA NAVIGATION
  function closeMenu(){nav.classList.remove('open');if(menuBtn){menuBtn.classList.remove('active');menuBtn.setAttribute('aria-expanded','false');menuBtn.setAttribute('aria-label','Ouvrir le menu');}}

  function renderNav(){nav.replaceChildren();state.navigation.forEach(function(item){var button=el('button','btn btn-link',item.label);button.type='button';button.classList.toggle('active',item.route===state.route);if(item.route===state.route)button.setAttribute('aria-current','page');button.addEventListener('click',function(){navigate(item.route,item.poleId?{pole:item.poleId}:{});});nav.append(button);});
    if(state.user){var mobileProfile=elBtn('Mon profil','btn btn-link nav-account'),mobileLogout=elBtn('Déconnexion','btn btn-link nav-account');mobileProfile.onclick=function(){navigate('profile/security');};mobileLogout.onclick=logoutCurrentSession;nav.append(mobileProfile,mobileLogout);}
    nav.hidden=!state.user;account.hidden=!state.user;if(menuBtn)menuBtn.hidden=!state.user;if(!state.user)closeMenu();}

  // NAVIGATION
  function navigate(route,extra,replace){state.route=route;extra=extra||{};if(extra.pole)state.poleId=extra.pole;if(extra.subject)state.subjectId=extra.subject;if(extra.registration)state.registrationId=extra.registration;

    closeMenu();

    var template=document.getElementById('page-'+route.replace(/\//g,'-'))||document.getElementById('page-access-denied');
    main.replaceChildren(template.content.cloneNode(true));
    state.renderStarted=performance.now();skeletonize(route);

    // Bind data-route attributes
    Array.prototype.forEach.call(main.querySelectorAll('[data-route]'),function(button){button.addEventListener('click',function(){navigate(button.dataset.route);});});

    if(!replace)history.pushState({route:route},'',urlFor(route,extra));
    renderNav();
    load(route);
    if(route==='login'&&document.getElementById('login-form')){performance.mark('aac-login-form-ready');renderDone(route);}
    main.focus();
  }

  // GÉNÉRATEUR DE CARTES
  function card(title,meta,body,classes){var item=el('article',(classes||'item')+' wall-card');if(title)item.append(el('h3','',title));if(meta)item.append(el('p','meta',meta));if(body)item.append(el('p','excerpt line-clamp-2',body));return item;}

  function elBtn(text,classes,type){var btn=el('button',classes||'btn secondary',text);if(type)btn.type=type;return btn;}

  function runTextAction(options,action,onSuccess){var dialog=document.getElementById('text-action-dialog'),form=document.getElementById('text-action-form'),input=document.getElementById('text-action-input'),confirmButton=document.getElementById('text-action-confirm'),cancelButton=document.getElementById('text-action-cancel');
    document.getElementById('text-action-title').textContent=options.title;document.getElementById('text-action-label').textContent=options.label;
    input.value=options.initialValue||'';input.maxLength=options.maxLength||3000;input.required=options.required!==false;confirmButton.textContent=options.confirmLabel||'Confirmer';alertOf(form,'');
    function cancel(){if(confirmButton.disabled)return;dialog.close();if(options.trigger&&options.trigger.isConnected)options.trigger.focus();}
    cancelButton.onclick=cancel;dialog.oncancel=function(event){event.preventDefault();cancel();};dialog.onkeydown=function(event){if(event.key==='Escape'){event.preventDefault();cancel();}};
    form.onsubmit=function(event){event.preventDefault();var value=input.value.trim();if(input.required&&!value){alertOf(form,'Ce champ est requis.');input.focus();return;}alertOf(form,'');busy(confirmButton,true);
      Promise.resolve().then(function(){return action(value);}).then(function(data){dialog.close();if(onSuccess)return onSuccess(data);}).catch(function(error){alertOf(form,error.message);}).finally(function(){busy(confirmButton,false);});};
    dialog.showModal();input.focus();
  }

  // CONTEXTE DE SESSION
  function requireContext(){if(!token()){var missing=new Error('Votre session a expiré. Veuillez vous reconnecter.');missing.code='SESSION_INVALID';return Promise.reject(missing);}if(state.user)return Promise.resolve();return api('bootstrapMember',token()).then(result).then(function(data){state.home=data.home;state.user=data.home.user;state.navigation=data.navigation||[];renderNav();});}

  function refreshHome(){return api('getMemberHome',token()).then(result).then(function(home){state.home=home;state.user=home.user;renderNav();return home;});}

  // GESTION DE L'ACCUEIL
  function renderNewItems(home){var container=document.getElementById('home-new-items');if(!container)return;
    var items=[];
    // Nouveaux sujets dans mes pôles
    if(home.newSubjectsInMyPoles&&home.newSubjectsInMyPoles.length>0){home.newSubjectsInMyPoles.forEach(function(subject){items.push({type:'SUJET',title:subject.titre,pole:subject.pole_name,question:subject.question_centrale,date:subject.date_modification||subject.date_ouverture,typeLabel:'Sujet',subjectId:subject.sujet_id,poleId:subject.pole_id,commentCount:subject.comment_count||0,supportCount:subject.support_count||0,supported_by_me:Boolean(subject.supported_by_me)});});}
    if(!items.length)empty(container,'Aucune nouvelle activité dans vos pôles.');else{container.replaceChildren();items.slice(0,6).forEach(function(item){var node=card(item.title,item.pole+' · '+'Sujet'+' · '+formatDate(item.date),item.question);
      var footer=el('div','new-item-footer');
      footer.append(el('span','',item.supportCount+' soutien'+(item.supportCount>1?'s':'')));
      footer.append(el('span','',item.commentCount+' commentaire'+(item.commentCount>1?'s':'')));
      node.append(footer);
      var actions=el('div','new-item-actions');
      var supportBtn=elBtn(item.supported_by_me?'Soutenu · '+item.supportCount:'Soutenir · '+item.supportCount,'btn secondary');
      supportBtn.onclick=function(){busy(supportBtn,true);api('toggleSubjectSupport',token(),item.subjectId).then(result).then(function(){notice('Soutien enregistré.');refreshHome().then(function(){renderNewItems(state.home);});}).catch(function(error){notice(error.message);}).finally(function(){busy(supportBtn,false);});};
      actions.append(supportBtn);
      var viewBtn=elBtn('VOIR LE DÉBAT','btn btn-link');viewBtn.onclick=function(){navigate('subject',{subject:item.subjectId,pole:item.poleId});};
      actions.append(viewBtn);
      node.append(actions);container.append(node);});}}

  function renderHomeContributions(home){var container=document.getElementById('home-contributions');if(!container)return;
    if(!home.myContributions||!home.myContributions.length)empty(container,'Vous n\'avez pas encore contribué.');else{container.replaceChildren();home.myContributions.slice(0,3).forEach(function(item){
      var statusLabel=getContributionStatusLabel(item);
      var body=item.description?(item.type==='IDEE'?item.description:'Commentaire : '+item.description):'';
      var node=card(item.title,item.pole_name+' · '+formatDate(item.date),body);
      node.append(el('p','status '+getStatusClass(item.status),statusLabel));
      if(item.subject_id){var openBtn=elBtn('Ouvrir le sujet','btn btn-link');openBtn.onclick=function(){navigate('subject',{subject:item.subject_id,pole:item.pole_id});};node.append(openBtn);}
      container.append(node);
    });}}

  function getStatusClass(status){var s=String(status).toUpperCase();if(['RETENUE','TRANSFORMEE_EN_SUJET'].includes(s))return'completed';if(['REJETEE','ARCHIVEE','FUSIONNEE'].includes(s))return'rejected';if(s==='A_COMPLETER')return'waiting';if(['EN_ATTENTE_VALIDATION','NOUVELLE','A_EXAMINER'].includes(s))return'in-progress';return'';}

  function loadHome(){requireContext().then(refreshHome).then(function(home){document.getElementById('home-greeting').textContent='Bonjour '+home.user.prenom;renderNewItems(home);renderHomeContributions(home);renderDone('home');}).catch(sessionFailure);}

  // MES CONTRIBUTIONS
  function contributionCard(item){var node=el('article','contribution-item');
    var header=el('div','contribution-header');
    var title=el('span','contribution-title',item.title);
    var type=el('span','contribution-type text-muted',item.type==='IDEE'?'Idée':'Commentaire');
    header.append(title,type);node.append(header);
    var statusLabel=getContributionStatusLabel(item);
    var statusBadge=el('span','status '+getStatusClass(item.status),statusLabel);
    var poleLine=el('p','');poleLine.append(el('span','text-muted','Pôle : '),document.createTextNode(item.pole_name+' · '+formatDate(item.date)));node.append(poleLine);
    var statusLine=el('p','');statusLine.append(statusBadge);node.append(statusLine);
    if(item.association_action&&item.association_action!==statusLabel)node.append(el('p','text-muted','Dernière évolution : '+item.association_action));
    if(item.type==='IDEE'&&item.description)node.append(el('p','contribution-desc',item.description));
    if(item.subject_id){var openBtn=elBtn('Ouvrir le sujet →','btn btn-link');openBtn.onclick=function(){navigate('subject',{subject:item.subject_id,pole:item.pole_id});};node.append(openBtn);}
    return node;}

  function loadContributions(){requireContext().then(refreshHome).then(function(home){var list=document.getElementById('contributions-list');if(!home.myContributions||!home.myContributions.length)empty(list,'Vous n\'avez pas encore contribué.');else{list.replaceChildren();home.myContributions.forEach(function(item){list.append(contributionCard(item));});}renderDone('contributions');}).catch(sessionFailure);}

  // MES PÔLES
  var POLE_IMAGE_BASE='https://www.angersaucoeur.org/images/poles/',
      POLE_IMAGES={
        INSTITUTIONS_DEMOCRATIE:'pole-01.jpg',
        JUSTICE_SECURITE_LIBERTES:'pole-02.jpg',
        FINANCES_PUBLIQUES:'pole-03.jpg',
        ECONOMIE_TRAVAIL_ENTREPRISES:'pole-04.jpg',
        EDUCATION_JEUNESSE_CULTURE:'pole-05.jpg',
        SANTE_PROTECTION_SOCIALE:'pole-06.jpg',
        LOGEMENT_MOBILITES_TERRITOIRES:'pole-07.jpg',
        ECOLOGIE_ENERGIE_AGRICULTURE:'pole-08.jpg',
        SCIENCE_NUMERIQUE_IA:'pole-09.jpg',
        EUROPE_DEFENSE_SOUVERAINETES:'pole-10.jpg'
      };

  // Le fond de .pole-media reste visible tant que l'image n'a pas chargé,
  // et redevient le seul rendu si elle échoue : pas de cadre vide.
  function poleMedia(pole){
    var media=el('div','pole-media'),file=POLE_IMAGES[String(pole&&pole.code||'')];
    if(!file)return media;
    var image=document.createElement('img');
    image.src=POLE_IMAGE_BASE+file;image.alt='';image.loading='lazy';image.decoding='async';
    image.onerror=function(){if(image.parentNode)image.parentNode.removeChild(image);};
    media.append(image);return media;
  }

  function poleCard(pole,isMember){var joined=pole.canOpen!==undefined?Boolean(pole.canOpen):Boolean(isMember);
    var node=el('article','pole-card');
    var media=poleMedia(pole);
    var copy=el('div','pole-copy');
    copy.append(el('h3','',pole.nom));
    if(pole.description)copy.append(el('p','text-muted text-small',pole.description));
    node.append(media,copy);
    var actions=el('div','actions mt-1');
    if(joined){var openBtn=elBtn('OUVRIR','btn btn-navy');openBtn.onclick=function(){navigate('pole',{pole:pole.pole_id});};var leaveBtn=elBtn('QUITTER LE PÔLE','btn btn-outline');leaveBtn.onclick=function(){busy(leaveBtn,true);api('leavePole',token(),pole.pole_id).then(result).then(function(){notice('Vous avez quitté le pôle.');loadPoles();}).catch(function(error){notice(error.message);}).finally(function(){busy(leaveBtn,false);});};actions.append(openBtn,leaveBtn);}else{var joinBtn=elBtn('REJOINDRE CE PÔLE','btn btn-navy');joinBtn.onclick=function(){busy(joinBtn,true);api('joinPole',token(),pole.pole_id).then(result).then(function(){notice('Vous avez rejoint le pôle.');loadPoles();}).catch(function(error){notice(error.message);}).finally(function(){busy(joinBtn,false);});};actions.append(joinBtn);}
    node.append(actions);return node;}

  function loadPoles(){var myPolesList=document.getElementById('my-poles-list'),availableList=document.getElementById('available-poles-list');
    requireContext().then(function(){return api('listPolesForMember',token()).then(result);}).then(function(data){
      var poles=data.items||[],joined=[],available=[];
      poles.forEach(function(pole){if(pole.membershipStatus==='ACTIF')joined.push(pole);else available.push(pole);});
      if(myPolesList){myPolesList.replaceChildren();
        if(!joined.length)empty(myPolesList,'Vous n’avez encore rejoint aucun pôle.');
        else joined.forEach(function(pole){myPolesList.append(poleCard(pole,true));});}
      if(availableList){availableList.replaceChildren();
        if(!available.length)empty(availableList,'Vous participez déjà à tous les pôles.');
        else available.forEach(function(pole){availableList.append(poleCard(pole,false));});}
      renderDone('poles');
    }).catch(function(error){
      if(error&&error.code==='SESSION_INVALID')return sessionFailure(error);
      var message=error&&error.message||'Les pôles n’ont pas pu être chargés.';
      if(myPolesList)myPolesList.replaceChildren();
      if(availableList)empty(availableList,message);
      notice(message);
    });}

  // IDÉES
  function ideaCard(idea){var node=card(idea.titre,idea.pole_name+' · '+formatDate(idea.date_creation),idea.description);
    var statusLabel=getIdeaStatusLabel(idea);
    node.append(el('p','status '+getStatusClass(idea.statut),statusLabel));
    if(idea.motif_decision)node.append(el('p','text-muted',idea.motif_decision));
    if(idea.support_count!==undefined)node.append(el('p','meta',idea.support_count+' soutien'+(idea.support_count>1?'s':'')));
    if(idea.sujet_id){var openBtn=elBtn('Ouvrir le sujet →','btn btn-link');openBtn.onclick=function(){navigate('subject',{subject:idea.sujet_id,pole:idea.pole_id});};node.append(openBtn);}
    return node;}

  function renderIdeas(items){var list=document.getElementById('ideas-list');if(!items||!items.length)return empty(list,'Vous n\'avez encore proposé aucune idée.');list.replaceChildren();items.forEach(function(idea){list.append(ideaCard(idea));});}

  function openIdeaDialog(){var dialog=document.getElementById('idea-dialog'),form=document.getElementById('idea-form'),select=form.elements.pole_id;select.replaceChildren();(state.home&&state.home.myPoles||[]).forEach(function(pole){var option=document.createElement('option');option.value=pole.pole_id;option.textContent=pole.nom;select.append(option);});if(state.route==='pole'&&state.poleId)select.value=state.poleId;dialog.showModal();}

  function bindIdeaDialog(onDone){var dialog=document.getElementById('idea-dialog'),form=document.getElementById('idea-form');document.getElementById('idea-cancel').onclick=function(){dialog.close();};form.onsubmit=function(event){event.preventDefault();var button=form.querySelector('.btn-navy');busy(button,true);api('createIdea',token(),formData(form)).then(result).then(function(){dialog.close();form.reset();notice('Idée envoyée au pôle.');return refreshHome();}).then(onDone).catch(function(error){alertOf(form,error.message);}).finally(function(){busy(button,false);});};
  }

  function loadIdeas(){requireContext().then(refreshHome).then(function(){return api('listMyIdeas',token()).then(result);}).then(function(data){renderIdeas(data.items);document.getElementById('new-idea').onclick=openIdeaDialog;bindIdeaDialog(function(){loadIdeas();});renderDone('ideas');}).catch(sessionFailure);}

  // MUR DU PÔLE
  function ideaWallCard(idea){var node=card(idea.titre,(idea.auteur?idea.auteur+' · ':'')+idea.pole_name+' · '+formatDate(idea.date_creation),idea.description);
    var meta=el('div','meta-row');
    meta.append(el('span','',idea.support_count+' soutien'+(idea.support_count>1?'s':'')));
    if(idea.statut_libelle)meta.append(el('span','status '+getStatusClass(idea.statut),getIdeaStatusLabel(idea)));
    node.append(meta);
    var supportBtn=elBtn(idea.supported_by_me?'Soutenu · '+idea.support_count:'Soutenir · '+idea.support_count,idea.supported_by_me?'btn btn-navy':'btn btn-outline');
    supportBtn.onclick=function(){busy(supportBtn,true);api('toggleIdeaSupport',token(),idea.idee_id).then(result).then(function(data){var updated=data.item;supportBtn.textContent=(updated.supported_by_me?'Soutenu':'Soutenir')+' · '+updated.support_count;supportBtn.className=updated.supported_by_me?'btn btn-navy':'btn btn-outline';}).catch(function(error){notice(error.message);}).finally(function(){busy(supportBtn,false);});};
    var actions=el('div','actions'),toggle=elBtn('Réactions','btn btn-link');actions.append(supportBtn,toggle);node.append(actions);
    var panel=el('div','stack'),list=el('div','stack'),input=document.createElement('textarea'),send=elBtn('Envoyer','btn btn-navy'),loaded=false;
    panel.hidden=true;input.placeholder='Votre réaction…';input.maxLength=1500;input.rows=3;input.setAttribute('aria-label','Votre réaction');
    panel.append(el('h3','','Réactions'),list,input,send);node.append(panel);
    function renderReactions(items){if(!items.length)return empty(list,'Aucune réaction pour le moment.');
      list.replaceChildren();items.forEach(function(item){list.append(card(item.auteur,formatDate(item.date_creation),item.contenu));});}
    toggle.onclick=function(){if(!panel.hidden){panel.hidden=true;return;}panel.hidden=false;if(loaded)return;busy(toggle,true);
      api('listIdeaExchanges',token(),idea.idee_id).then(result).then(function(data){loaded=true;renderReactions(data.items||[]);})
        .catch(function(error){empty(list,error.message);}).finally(function(){busy(toggle,false);});};
    send.onclick=function(){var text=input.value.trim();if(!text)return;busy(send,true);
      api('addIdeaExchange',token(),idea.idee_id,text).then(result).then(function(data){var item=data.item||data;input.value='';
        if(!loaded||list.querySelector('.empty')){loaded=true;list.replaceChildren();}
        list.append(card('Vous',formatDate(item.date_creation),item.contenu));notice('Réaction publiée.');})
        .catch(function(error){notice(error.message);}).finally(function(){busy(send,false);});};
    return node;}

  function subjectWallCard(subject){var node=card(subject.titre,subject.pole_name+' · '+formatDate(subject.date_modification||subject.date_ouverture),subject.question_centrale);
    var meta=el('div','meta-row');
    if(subject.support_count!==undefined)meta.append(el('span','badge-support',subject.support_count+' soutien'+(subject.support_count>1?'s':'')));
    if(subject.comment_count!==undefined)meta.append(el('span','badge-comment',subject.comment_count+' commentaire'+(subject.comment_count>1?'s':'')));
    if(subject.statut_libelle)meta.append(el('span','status',subject.statut_libelle));
    node.append(meta);
    var actions=el('div','actions');
    var supportBtn=elBtn(subject.supported_by_me?'Soutenu · '+subject.support_count:'Soutenir · '+subject.support_count,subject.supported_by_me?'btn btn-navy':'btn btn-outline');
    supportBtn.onclick=function(){busy(supportBtn,true);api('toggleSubjectSupport',token(),subject.sujet_id).then(result).then(function(){loadPole();}).catch(function(error){notice(error.message);}).finally(function(){busy(supportBtn,false);});};
    actions.append(supportBtn);
    var viewBtn=elBtn('VOIR LE DÉBAT','btn btn-link');viewBtn.onclick=function(){navigate('subject',{subject:subject.sujet_id,pole:subject.pole_id});};
    actions.append(viewBtn);
    node.append(actions);return node;}

  function renderPoleWall(wall,filter){
    var ideasContainer=document.getElementById('pole-ideas'),subjectsContainer=document.getElementById('pole-subjects');
    var ideas=filter==='feature'?[]:(filter==='supported'?(wall.mostSupportedIdeas||[]):(wall.recentIdeas||[]));
    var subjects=filter==='feature'?(wall.featuredSubjects||[]):(filter==='supported'?(wall.mostSupportedSubjects||[]):(wall.recentSubjects||[]));
    ideasContainer.replaceChildren();subjectsContainer.replaceChildren();
    if(!ideas.length)empty(ideasContainer,filter==='feature'?'Les idées ne disposent pas de mécanisme de mise en avant.':'Aucune idée dans ce pôle.');else ideas.forEach(function(item){ideasContainer.append(ideaWallCard(item));});
    if(!subjects.length)empty(subjectsContainer,filter==='feature'?'Aucun sujet n’est actuellement mis en avant.':'Aucun sujet ouvert.');else subjects.forEach(function(item){subjectsContainer.append(subjectWallCard(item));});
  }

  function loadPole(){requireContext().then(function(){return api('getPolePageData',state.poleId,{page:1,pageSize:20},token()).then(result);}).then(function(wall){document.getElementById('pole-title').textContent=wall.pole.nom;document.getElementById('pole-description').textContent=wall.pole.description;
    var hero=document.getElementById('pole-hero');if(hero)hero.replaceChildren.apply(hero,Array.prototype.slice.call(poleMedia(wall.pole).childNodes));
    renderPoleWall(wall,'feature');
    Array.prototype.forEach.call(document.querySelectorAll('.filter-pill'),function(button){button.onclick=function(){Array.prototype.forEach.call(document.querySelectorAll('.filter-pill'),function(item){var active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));});renderPoleWall(wall,button.dataset.filter);};});
    // Bind new idea button
    var newIdeaBtn=document.getElementById('new-idea-pole');if(newIdeaBtn)newIdeaBtn.onclick=openIdeaDialog;
    bindIdeaDialog(function(){loadPole();});
    renderDone('pole');
  }).catch(sessionFailure);}

  // PAGE SUJET
  function renderComment(comment,rights){var node=el('article','comment-item');
    var meta=el('div','comment-meta');
    var authorName=comment.auteur?comment.auteur.prenom+' '+comment.auteur.nom:'Membre';
    meta.append(el('strong','',authorName+ ' · '));
    meta.append(el('span','',formatDate(comment.date_creation)));
    node.append(meta);
    node.append(el('div','comment-content',comment.contenu));
    var actions=el('div','actions mt-1');
    if(comment.can_edit){var editBtn=elBtn('Modifier','btn btn-link');editBtn.onclick=function(){runTextAction({title:'Modifier le commentaire',label:'Votre commentaire',initialValue:comment.contenu,maxLength:3000,confirmLabel:'Enregistrer',trigger:editBtn},function(text){return api('editOwnSubjectComment',token(),comment.contribution_id,text).then(result);},loadSubject);};actions.append(editBtn);}
    if(rights.can_manage){var moderateBtn=elBtn('Modérer','btn btn-link');moderateBtn.onclick=function(){runTextAction({title:'Modérer le commentaire',label:'Motif de modération',maxLength:500,confirmLabel:'Modérer',trigger:moderateBtn},function(reason){return api('moderateSubjectComment',token(),comment.contribution_id,reason).then(result);},loadSubject);};actions.append(moderateBtn);}
    if(actions.children.length>0)node.append(actions);return node;}

  function loadSubject(){requireContext().then(function(){return api('getSubjectDetail',state.subjectId,{page:1,pageSize:30},token()).then(result);}).then(function(subject){document.getElementById('subject-title').textContent=subject.titre;document.getElementById('subject-question').textContent=subject.question_centrale;
    var metaContainer=document.getElementById('subject-meta');if(metaContainer){metaContainer.replaceChildren();
      metaContainer.append(el('span','badge-support',subject.support_count+' soutien'+(subject.support_count>1?'s':'')));
      metaContainer.append(el('span','', ' · '));
      metaContainer.append(el('span','badge-comment',subject.comment_count+' commentaire'+(subject.comment_count>1?'s':'')));
    }
    document.getElementById('subject-back').onclick=function(){navigate('pole',{pole:subject.pole_id});};
    var supportBtn=document.getElementById('subject-support');
    if(supportBtn){supportBtn.textContent=(subject.supported_by_me?'Soutenu':'Soutenir')+' · '+subject.support_count;
      supportBtn.className=subject.supported_by_me?'btn btn-navy':'btn btn-outline';
      supportBtn.onclick=function(){busy(supportBtn,true);api('toggleSubjectSupport',token(),subject.sujet_id).then(result).then(function(){loadSubject();}).catch(function(error){notice(error.message);}).finally(function(){busy(supportBtn,false);});};
    }
    var comments=document.getElementById('subject-comments');if(comments){if(!subject.comments||!subject.comments.length)empty(comments,'Aucun commentaire.');else{comments.replaceChildren();subject.comments.forEach(function(comment){comments.append(renderComment(comment,subject.rights));});}}
    var form=document.getElementById('comment-form');if(form){form.onsubmit=function(event){event.preventDefault();var button=form.querySelector('.btn-navy');busy(button,true);api('addSubjectComment',token(),subject.sujet_id,form.elements.text.value).then(result).then(function(){form.reset();loadSubject();}).catch(function(error){alertOf(form,error.message);}).finally(function(){busy(button,false);});};}renderDone('subject');}).catch(sessionFailure);}

  // ESPACE RÉFÉRENT
  function qualificationButton(idea,label,status){var button=elBtn(label,'btn btn-outline');button.onclick=function(){var requiresMessage=status==='A_COMPLETER'||status==='REJETEE';
      if(requiresMessage){runTextAction({title:status==='A_COMPLETER'?'Demander un complément':'Écarter l’idée',label:status==='A_COMPLETER'?'Précisez le complément attendu':'Motif adressé au membre',maxLength:1000,confirmLabel:status==='A_COMPLETER'?'Envoyer la demande':'Écarter',trigger:button},function(message){return api('qualifyIdea',token(),idea.idee_id,status,message).then(result);},loadReferent);return;}
      busy(button,true);api('qualifyIdea',token(),idea.idee_id,status,'').then(result).then(loadReferent).catch(function(error){notice(error.message);}).finally(function(){busy(button,false);});};return button;}

  function loadReferent(){requireContext().then(function(){return api('getReferentWorkspace',state.poleId,token()).then(result);}).then(function(work){document.getElementById('referent-title').textContent='Gérer '+work.pole.nom;document.getElementById('referent-attention').textContent=work.attentionCount+' élément(s) demandent votre attention.';
    var ideas=document.getElementById('referent-ideas'),subjects=document.getElementById('referent-subjects');
    [ideas,subjects].forEach(function(x){if(x)x.replaceChildren();});
    if(ideas&&!work.attentionIdeas.length)empty(ideas,'Aucune idée à examiner.');
    else if(ideas)work.attentionIdeas.forEach(function(idea){var node=card(idea.titre,idea.statut_libelle,idea.description);var actions=el('div','actions');
      if(idea.statut==='RETENUE'){var transform=elBtn('Transformer en sujet','btn btn-navy');transform.onclick=function(){busy(transform,true);api('transformIdeaToSubject',token(),idea.idee_id,{}).then(result).then(loadReferent).catch(function(error){notice(error.message);}).finally(function(){busy(transform,false);});};actions.append(transform);}else{var available=[];if(idea.statut!=='A_EXAMINER')available.push(['Examiner','A_EXAMINER']);if(idea.statut!=='A_COMPLETER')available.push(['Demander un complément','A_COMPLETER']);available.push(['Retenir','RETENUE'],['Écarter','REJETEE']);available.forEach(function(action){actions.append(qualificationButton(idea,action[0],action[1]));});}
      var exchanges=el('div','stack'),show=elBtn('Voir les échanges','btn btn-link'),reply=elBtn('Répondre au membre','btn btn-link');
      show.onclick=function(){api('listIdeaExchanges',token(),idea.idee_id).then(result).then(function(data){if(!data.items||!data.items.length)empty(exchanges,'Aucun échange.');else{exchanges.replaceChildren();data.items.forEach(function(exchange){exchanges.append(card(exchange.auteur,formatDate(exchange.date_creation),exchange.contenu));});}}).catch(function(error){notice(error.message);});};
      reply.onclick=function(){runTextAction({title:'Répondre au membre',label:'Votre message',maxLength:1500,confirmLabel:'Envoyer',trigger:reply},function(text){return api('addIdeaExchange',token(),idea.idee_id,text).then(result);},function(){notice('Message envoyé.');show.click();});};
      node.append(actions,show,reply,exchanges);ideas.append(node);});
    if(subjects&&!work.activeSubjects.length)empty(subjects,'Aucun sujet actif.');
    else if(subjects)work.activeSubjects.forEach(function(subject){var node=card(subject.titre,subject.statut_libelle,subject.question_centrale);var actions=el('div','actions');var important=elBtn(subject.important?'Retirer la mise en avant':'Mettre en avant','btn btn-outline');important.onclick=function(){busy(important,true);api('updateSubject',token(),subject.sujet_id,{important:!subject.important}).then(result).then(loadReferent).catch(function(error){notice(error.message);}).finally(function(){busy(important,false);});};var close=elBtn('Clore','btn btn-danger');close.onclick=function(){busy(close,true);api('updateSubject',token(),subject.sujet_id,{statut:'CLOS'}).then(result).then(loadReferent).catch(function(error){notice(error.message);}).finally(function(){busy(close,false);});};actions.append(important,close);node.append(actions);subjects.append(node);});renderDone('referent');}).catch(sessionFailure);}

  // PROFIL
  function loadProfile(){requireContext().then(function(){var form=document.getElementById('profile-form'),user=state.user;['prenom','nom','email','telephone','age','profession','commentaire','interets'].forEach(function(name){if(form.elements[name])form.elements[name].value=user[name]||'';});form.addEventListener('submit',function(event){event.preventDefault();api('updateOwnProfile',token(),formData(form)).then(result).then(function(data){state.user=data.user;notice('Profil enregistré.');}).catch(function(error){alertOf(form,error.message);});});var password=document.getElementById('password-form');password.addEventListener('submit',function(event){event.preventDefault();var data=formData(password);api('changeOwnPassword',token(),data.currentPassword,data.newPassword,data.confirmation).then(result).then(function(){password.reset();notice('Mot de passe modifié.');}).catch(function(error){alertOf(password,error.message);});});document.getElementById('logout-all').onclick=function(){api('logoutAllSessions',token()).then(result).then(function(data){notice(data.revoked+' autre(s) session(s) fermée(s).');}).catch(function(error){notice(error.message);});};renderDone('profile/security');}).catch(sessionFailure);}

  // SUPER ADMINISTRATION
  function loadRegistrations(){requireContext().then(function(){return Promise.all([
      api('listSuperAdminRegistrations',token()).then(result),api('listSuperAdminAccounts',token()).then(result)
    ]);}).then(function(data){var pending=data[0].items||[],accounts=data[1].items||[],list=document.getElementById('registrations-list'),accountList=document.getElementById('accounts-list');
      if(!pending.length)empty(list,'Aucune demande en attente.');else{list.replaceChildren();pending.forEach(function(item){var node=card(item.prenom+' '+item.nom,item.statut_libelle+' · '+item.email_verification_label+' · '+formatDate(item.date_demande),item.email);var button=elBtn('Ouvrir le dossier','btn btn-link');button.onclick=function(){navigate('admin/registration',{registration:item.demande_id});};node.append(button);list.append(node);});}
      if(!accounts.length)empty(accountList,'Aucun compte actif ou désactivé.');else{accountList.replaceChildren();accounts.forEach(function(item){var node=card(item.prenom+' '+item.nom,item.statut_compte_libelle,item.email),actions=el('div','actions');if(item.user_id===state.user.user_id){actions.append(el('span','text-muted text-small','Votre compte administrateur'));}else{var active=item.statut_compte==='ACTIVE'||item.statut_compte==='ACTIF',button=elBtn(active?'Désactiver':'Réactiver',active?'btn btn-danger':'btn btn-outline');button.onclick=function(){busy(button,true);api(active?'deactivateAccountAsSuperAdmin':'reactivateAccountAsSuperAdmin',token(),item.user_id).then(result).then(function(response){notice(response.changed?(active?'Compte désactivé.':'Compte réactivé.'):'Aucun changement nécessaire.');loadRegistrations();}).catch(sessionFailure).finally(function(){busy(button,false);});};actions.append(button);}node.append(actions);accountList.append(node);});}renderDone('admin/registrations');
    }).catch(sessionFailure);}

  function loadRegistration(){requireContext().then(function(){return api('getSuperAdminRegistration',token(),state.registrationId).then(result);}).then(function(data){var item=data.item;document.getElementById('registration-name').textContent=item.prenom+' '+item.nom;var detail=document.getElementById('registration-detail');detail.replaceChildren(
      el('p','',item.email),el('p','',item.telephone||'Téléphone non renseigné'),el('p','',item.profession||'Profession non renseignée'),el('p','',item.commentaire||'Présentation non renseignée'),
      el('p','status','Adresse électronique : '+(item.email_verifie?'confirmée le '+formatDate(item.date_email_verifie):item.email_verification_label)),
      el('p','status','Charte : '+(item.charte_acceptee?'acceptée le '+formatDate(item.charte_acceptee_date):'acceptation non enregistrée')),el('p','status','État : '+item.statut_libelle));
    // Removed interests display per V1 rules
    var actions=document.getElementById('registration-actions');actions.replaceChildren(el('h2','','Décision du responsable habilité'));renderDone('admin/registration');
    function bindReject(button){button.onclick=function(){runTextAction({title:'Rejeter la demande',label:'Motif communiqué au demandeur',maxLength:2000,confirmLabel:'Rejeter',trigger:button},function(reason){return api('rejectRegistrationAsSuperAdmin',token(),item.demande_id,reason).then(result);},function(response){notice(response.warning||response.message||'Demande rejetée.');navigate('admin/registrations');});};}
    var approvable=['EMAIL_A_VERIFIER','PENDING_ADMIN_APPROVAL','EN_ATTENTE_VALIDATION','INFORMATIONS_DEMANDEES'].indexOf(item.statut)>=0;if(!approvable){if(item.statut==='PENDING_ACTIVATION'){var resend=elBtn('Renvoyer un lien d’activation','btn btn-outline'),cancel=elBtn('Rejeter','btn btn-danger'),pendingButtons=el('div','actions');actions.append(el('p','state-info','La demande est acceptée ; le compte attend l’activation par son titulaire.'));resend.onclick=function(){busy(resend,true);api('resendRegistrationActivationAsSuperAdmin',token(),item.demande_id).then(result).then(function(response){notice(response.warning||response.message);}).catch(sessionFailure).finally(function(){busy(resend,false);});};bindReject(cancel);pendingButtons.append(resend,cancel);actions.append(pendingButtons);}else actions.append(el('p','state-info','Cette demande a déjà été traitée.'));return;}
    var buttons=el('div','actions'),approve=elBtn(item.email_verifie?'Approuver et activer':'Accepter et envoyer le lien d’activation','btn btn-navy'),reject=elBtn('Rejeter','btn btn-danger');
    approve.onclick=function(){busy(approve,true);busy(reject,true);api('approveRegistrationAsSuperAdmin',token(),item.demande_id).then(result).then(function(response){notice(response.warning||response.message||(response.already_processed?'Demande déjà approuvée.':'Compte activé.'));navigate('admin/registrations');}).catch(sessionFailure).finally(function(){busy(approve,false);busy(reject,false);});};
    bindReject(reject);buttons.append(approve,reject);actions.append(buttons);
  }).catch(sessionFailure);}

  // GESTION DE SESSION
  function endSession(error){setToken('');state.user=null;state.home=null;state.navigation=[];renderNav();notice(error&&error.message||'Votre session a expiré. Veuillez vous reconnecter.');navigate('login');}

  function sessionFailure(error){
    if(!token())return endSession(error);
    if(error&&error.code==='SESSION_INVALID')return endSession(new Error('Votre session a expiré. Veuillez vous reconnecter.'));
    if(error&&error.code==='PERMISSION_DENIED'){
      api('bootstrapMember',token()).then(result).then(function(){notice(error.message);navigate('access-denied');}).catch(endSession);return;
    }
    notice(error&&error.message||'Une erreur est survenue.');
  }

  function logoutCurrentSession(){var current=token();setToken('');state.user=null;state.home=null;state.navigation=[];renderNav();if(current)api('logout',current).catch(function(){});navigate('login');}

  // AUTHENTIFICATION
  function loadLogin(){var form=document.getElementById('login-form');form.addEventListener('submit',function(event){event.preventDefault();var data=formData(form),button=form.querySelector('.btn-navy');alertOf(form,'');busy(button,true);api('login',data.email,data.password,navigator.userAgent).then(function(response){if(response&&response.ok===false){if(response.route)navigate(response.route);throw new Error(response.message);}return result(response);}).then(function(data){setToken(data.sessionToken);state.user=data.user;state.home=data.home;state.navigation=data.navigation||[];navigate('home');}).catch(function(error){alertOf(form,error.message);}).finally(function(){busy(button,false);});});}

  function loadRegister(){var form=document.getElementById('register-form'),dialog=document.getElementById('charter-dialog'),open=document.getElementById('read-charter');
    open.onclick=function(){dialog.showModal();document.querySelector('#charter-dialog .charter-content').focus();};dialog.onclose=function(){if(open.isConnected)open.focus();};['charter-close','charter-close-top'].forEach(function(id){document.getElementById(id).onclick=function(){dialog.close();};});
    form.addEventListener('submit',function(event){event.preventDefault();var data=formData(form);data.charteAcceptee=Boolean(form.elements.charteAcceptee.checked);var button=form.querySelector('.btn-navy');busy(button,true);api('register',data).then(result).then(function(response){notice(response.message);navigate(response.route||'registration-sent');}).catch(function(error){alertOf(form,error.message);}).finally(function(){busy(button,false);});});}

  function enterMemberSpace(message){try{history.replaceState({route:'home'},'',urlFor('home'));}catch(error){}navigate('home',{},true);if(message)notice(message);}

  function loadVerify(){var box=document.getElementById('verify-message'),title=document.getElementById('verify-title'),login=document.getElementById('verify-login');
    api('verifyEmail',linkToken(),navigator.userAgent).then(result).then(function(data){
      if(data.sessionToken){setToken(data.sessionToken);if(data.home){state.home=data.home;state.user=data.home.user||data.user;state.navigation=data.navigation||[];}return enterMemberSpace(data.message);}
      if(data.outcome==='ALREADY_ACTIVE'&&token())return enterMemberSpace('');
      var labels={ACTIVATED:'Votre espace est activé',ALREADY_ACTIVE:'Votre espace est déjà activé',REQUEST_PENDING:'Adresse confirmée',EXPIRED:'Ce lien a expiré',INVALID:'Lien non valide'};
      title.textContent=labels[data.outcome]||'Activation de votre espace';box.textContent=data.message;
      login.hidden=!(data.outcome==='ACTIVATED'||data.outcome==='ALREADY_ACTIVE');
    }).catch(function(){title.textContent='Activation indisponible';box.textContent='L’activation ne peut pas être effectuée pour le moment. Réessayez ultérieurement.';});}

  function loadForgot(){var form=document.getElementById('forgot-form');form.addEventListener('submit',function(event){event.preventDefault();api('requestPasswordReset',form.elements.email.value).then(result).then(function(data){alertOf(form,data.message,true);form.reset();}).catch(function(error){alertOf(form,error.message);});});}

  function loadReset(){var form=document.getElementById('reset-form'),formToken=linkToken();api('validatePasswordResetToken',formToken).then(result).then(function(data){if(!data.valid)throw new Error('Lien invalide ou expiré.');}).catch(function(error){alertOf(form,error.message);form.querySelector('.btn-navy').disabled=true;});form.addEventListener('submit',function(event){event.preventDefault();var data=formData(form);api('resetPassword',formToken,data.password,data.confirmation).then(result).then(function(){notice('Mot de passe modifié.');navigate('login');}).catch(function(error){alertOf(form,error.message);});});}

  function loadMembershipActivation(){var form=document.getElementById('membership-activation-form'),formToken=linkToken();api('validateMembershipActivationToken',formToken).then(result).then(function(data){if(!data.valid)throw new Error('Lien invalide ou expiré.');}).catch(function(error){alertOf(form,error.message);form.querySelector('.btn-navy').disabled=true;});form.addEventListener('submit',function(event){event.preventDefault();var data=formData(form),button=form.querySelector('.btn-navy');busy(button,true);api('activateMembershipAccount',formToken,data.password,data.confirmation,navigator.userAgent).then(result).then(function(response){setToken(response.sessionToken);state.user=response.user;state.home=response.home;state.navigation=response.navigation||[];enterMemberSpace('Votre espace est activé.');}).catch(function(error){alertOf(form,error.message);}).finally(function(){busy(button,false);});});}


  // CHARGEMENT DES PAGES
  function load(route){if(route==='login')loadLogin();else if(route==='register')loadRegister();else if(route==='verify-email')loadVerify();else if(route==='forgot-password')loadForgot();else if(route==='reset-password')loadReset();else if(route==='activate-membership')loadMembershipActivation();else if(route==='home')loadHome();else if(route==='contributions')loadContributions();else if(route==='poles')loadPoles();else if(route==='ideas')loadIdeas();else if(route==='pole')loadPole();else if(route==='subject')loadSubject();else if(route==='referent')loadReferent();else if(route==='profile/security')loadProfile();else if(route==='admin/registrations')loadRegistrations();else if(route==='admin/registration')loadRegistration();else renderDone(route);}

  // BINDING GLOBAL
  document.querySelector('.logo-wrap').addEventListener('click',function(e){e.preventDefault();navigate(token()?'home':'login');});
  document.getElementById('profile-button').onclick=function(){navigate('profile/security');};
  document.getElementById('logout-button').onclick=logoutCurrentSession;
  if(menuBtn)menuBtn.onclick=function(){var open=nav.classList.toggle('open');menuBtn.classList.toggle('active',open);menuBtn.setAttribute('aria-expanded',String(open));menuBtn.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu');};

  window.addEventListener('popstate',function(){state.route=initialRoute();routeData();navigate(state.route,{},true);});
  window.addEventListener('hashchange',function(){var route=initialRoute();if(route!==state.route){state.route=route;routeData();navigate(state.route,{},true);}});
  state.route=initialRoute();routeData();

  if(token()&&!publicRoute(state.route))requireContext().then(function(){navigate(state.route,{},true);}).catch(sessionFailure);
  else navigate(state.route,{},true);
})();
