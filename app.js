import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY} from './config.js';

const $ = (s) => document.querySelector(s);
const htmlEscape = value => String(value ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt = value => value ? new Date(value+'T12:00:00').toLocaleDateString('pt-BR') : '';
const stageNames = {'grupos':'Fase de grupos','playoff':'Playoffs','semi':'Semifinais','final':'Final','terceiro':'3º lugar','louca':'Copa-Louça'};
const stageOrder = ['grupos','playoff','semi','terceiro','final','louca'];
const logo = './assets/COPOLLGA_EMBLEMA_OFICIAL_ORIGINAL.png';
const storageTournament = 'copollga6:selectedTournament';
const configured = /^https:\/\/[^ ]+\.supabase\.co\/?$/.test(SUPABASE_URL) && SUPABASE_PUBLISHABLE_KEY.length > 24 && !SUPABASE_PUBLISHABLE_KEY.includes('COLE_AQUI');
const sb = configured ? createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) : null;
let currentUser = null, page = 'home', selectedTournament = localStorage.getItem(storageTournament) || null;
let data={profiles:[],clubs:[],players:[],tournaments:[],tournament_entries:[],matches:[],match_goals:[],transfer_offers:[],group_standings:[]};
let busy=false, timer=null, notifications='';
let selectedClub='all', playerSearch='', offerFrom='', offerTo='', goalClub='';

function inform(message,kind='ok') {
 notifications=message;
 const region=$('#toast');
 if(region){region.textContent=message;region.className='toast visible '+kind;}
}
function club(id){return data.clubs.find(x=>x.id===id) || {id,name:'Clube indisponível',abbr:'—'};}
function person(id){return data.profiles.find(x=>x.id===id) || {display_name:'Sem técnico'};}
function player(id){return data.players.find(x=>x.id===id) || {name:'Jogador indisponível'};}
function tournament(){return data.tournaments.find(x=>x.id===selectedTournament) || data.tournaments[0] || null;}
function isAdmin(){return !!(currentUser && data.profiles.some(p=>p.id===currentUser.id && p.is_admin));}
function myClubs(){return data.clubs.filter(c=>c.coach_id===currentUser?.id);}
function canSendOffer(){return isAdmin() || myClubs().length>0;}
function winner(m){if(m?.status!=='finalizada')return null;if(m.home_goals>m.away_goals)return m.home_club_id;if(m.away_goals>m.home_goals)return m.away_club_id;if(m.home_pen!=null&&m.away_pen!=null&&m.home_pen!==m.away_pen)return m.home_pen>m.away_pen?m.home_club_id:m.away_club_id;return null;}
function loser(m){const w=winner(m);return w?(w===m.home_club_id?m.away_club_id:m.home_club_id):null;}
function crest(id,size='') {
 const c=club(id);
 return `<span class="crest ${size}"><img loading="lazy" alt="Escudo ilustrativo ${htmlEscape(c.name)}" src="./assets/${htmlEscape(c.crest_file || '')}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"/><span class="crest-fallback" style="display:none">${htmlEscape((c.abbr||c.name).slice(0,2))}</span></span>`;
}
function team(id,small=false){return `<span class="team ${small?'small-team':''}">${crest(id,small?'tiny':'')}<span>${htmlEscape(club(id).name)}</span></span>`;}
function alertHtml(){return '<div id="toast" class="toast" role="status" aria-live="polite"></div>';}
const appRoot=()=>$('#root');
function appShell(content){return `<div class="layout">
<aside class="sidebar"><div class="brand"><img src="${logo}" alt="Emblema oficial original da COPOLLGA"/><div><strong>COPOLLGA</strong><small>LIGA PES 2011</small></div></div>
<div class="nav-caption">MENU DA LIGA</div><nav class="nav">
${[['home','house','Início'],['tournaments','calendar-days','Campeonatos'],['matches','swords','Partidas'],['standings','list-ordered','Classificação'],['scorers','goal','Artilharia'],['clubs','shield','Clubes e elencos'],['offers','arrow-left-right','Transferências'],['ranking','trophy','Ranking 5 • 3 • 2'],['admin','settings','Administração']].filter(x=>x[0]!=='admin'||isAdmin()).map(([key,sym,label])=>`<button class="nav-button ${page===key?'active':''}" data-action="nav" data-page="${key}"><span class="nav-icon">${({house:'⌂','calendar-days':'▤',swords:'⚔','list-ordered':'☷',goal:'⚽',shield:'⬡','arrow-left-right':'⇄',trophy:'🏆',settings:'⚙'})[sym]}</span>${label}</button>`).join('')}
</nav><div class="side-footer"><span class="live-dot"></span> <strong>Base compartilhada</strong><p>Dados sincronizados pelo Supabase. Conexão obrigatória.</p><button class="button ghost block" data-action="refresh">↻ Atualizar agora</button></div></aside>
<div class="main"><header class="topbar"><div class="top-title"><span class="eyebrow">COPOLLGA ONLINE</span><strong>${htmlEscape(({'home':'Painel da liga','tournaments':'Campeonatos','matches':'Jogos e resultados','standings':'Classificação','scorers':'Artilharia','clubs':'Clubes e elencos','offers':'Mercado de transferências','ranking':'Pontuação histórica','admin':'Administração'})[page])}</strong></div><div class="profile"><span class="user-nick">${htmlEscape(person(currentUser.id).display_name)}</span><span class="profile-role">${isAdmin()?'Administrador':myClubs().length?'Técnico':'Acompanhamento'}</span><button class="button small" data-action="logout">Sair</button></div></header>
<main class="content">${content}</main><footer class="footer">COPOLLGA 6.0 • Testes online • Emblema oficial preservado • Elencos históricos ainda precisam de conferência</footer></div></div><div id="modalHost"></div>${alertHtml()}`;}
function sectionTitle(title,sub='',tools=''){return `<div class="section-head"><div><h1>${htmlEscape(title)}</h1>${sub?`<p>${htmlEscape(sub)}</p>`:''}</div>${tools?`<div class="head-tools">${tools}</div>`:''}</div>`;}
function selectedTourneyPicker(){const t=tournament();return `<label class="select-label">Campeonato <select id="tournamentPicker" data-action="changeTournament">${data.tournaments.map(x=>`<option value="${x.id}" ${t?.id===x.id?'selected':''}>${htmlEscape(x.name)} • ${fmt(x.event_date)}</option>`).join('')}</select></label>`;}
function badge(s){return `<span class="pill ${s==='concluido'?'done':''}">${htmlEscape(s)}</span>`;}
function statsTiles(tiles){return `<div class="kpi-grid">${tiles.map(([num,label])=>`<article class="kpi"><strong>${htmlEscape(num)}</strong><span>${htmlEscape(label)}</span></article>`).join('')}</div>`;}
function notice(s){return `<div class="note">${s}</div>`;}
function recentGames(limit=6){return data.matches.filter(m=>m.tournament_id===tournament()?.id).sort((a,b)=>(a.status==='finalizada'?1:0)-(b.status==='finalizada'?1:0)||a.round_no-b.round_no).slice(0,limit).map(matchCard).join('')||notice('Nenhuma partida cadastrada ainda.');}
function homeView(){
 const t=tournament(), ms=data.matches.filter(m=>m.tournament_id===t?.id);
 const upcoming=ms.filter(m=>m.status==='agendada').length;
 return `${sectionTitle('Bem-vindo à COPOLLGA','Sua liga PES 2011: campeonatos, resultados, elencos e mercado compartilhados.',isAdmin()?'<button class="button gold" data-action="nav" data-page="tournaments">+ Criar campeonato</button>':'')}
 <section class="hero"><div class="hero-copy"><span class="eyebrow">A CASA DOS CAMPEÕES</span><h2>O FUTEBOL<br/><em>É NOSSO.</em></h2><p>Uma liga, dez clubes e uma disputa que vai além dos gramados. Acompanhe tudo pelo celular.</p><div class="hero-actions"><button class="button gold" data-action="nav" data-page="matches">Ver partidas</button><button class="button" data-action="nav" data-page="ranking">Ranking geral</button></div></div><div class="hero-logo"><img src="${logo}" alt="Emblema original COPOLLGA, sem modificações"/></div></section>
 ${statsTiles([[data.clubs.length,'Clubes'],[data.players.length,'Jogadores importados'],[data.tournaments.length,'Campeonatos'],[upcoming,'Próximos jogos']])}
 <div class="two-columns"><section class="panel"><header class="panel-head"><h3>${t?htmlEscape(t.name):'Campeonato do dia'}</h3>${t?badge(t.status):''}</header><div class="panel-body">${t?`<p class="muted">${fmt(t.event_date)} • ${data.tournament_entries.filter(e=>e.tournament_id===t.id).length} clubes</p><div class="button-row"><button class="button" data-action="nav" data-page="standings">Ver grupos</button><button class="button" data-action="nav" data-page="matches">Ver chaveamento</button></div>`:notice('O administrador ainda não criou o primeiro campeonato.')}</div></section>
 <section class="panel"><header class="panel-head"><h3>Próximos confrontos</h3><button class="link-button" data-action="nav" data-page="matches">Ver todos</button></header><div class="panel-body games-list">${recentGames(4)}</div></section></div>
 <section class="panel"><header class="panel-head"><h3>Clubes participantes</h3><button class="link-button" data-action="nav" data-page="clubs">Ver elencos</button></header><div class="club-strip">${data.clubs.map(c=>`<div class="club-icon">${crest(c.id,'large')}<small>${htmlEscape(c.abbr)}</small></div>`).join('')}</div><div class="caption">Os escudos locais são ilustrações provisórias; o emblema COPOLLGA é a imagem original.</div></section>`;
}
function tournamentsView(){const t=tournament();return `${sectionTitle('Campeonatos','Crie edições com 4 a 10 clubes, dois grupos e confrontos somente de ida.')}
 ${isAdmin()?`<section class="panel"><header class="panel-head"><h3>+ Novo campeonato do dia</h3></header><form id="createTournamentForm" class="panel-body"><div class="form-grid"><label>Nome da edição<input name="name" required minlength="3" maxlength="100" value="Copa COPOLLGA" /></label><label>Data<input type="date" name="date" required value="${new Date().toISOString().slice(0,10)}" /></label></div><p class="muted">Selecione entre 4 e 10 clubes. O sorteio e os jogos internos dos grupos serão gerados automaticamente, com uma única ida.</p><div class="club-checks">${data.clubs.map(c=>`<label class="club-check"><input type="checkbox" name="clubs" value="${c.id}" checked/> ${crest(c.id,'tiny')} ${htmlEscape(c.name)}</label>`).join('')}</div><div class="button-row"><button class="button gold" type="submit">Sortear grupos e gerar partidas</button></div></form></section>`:''}
 <section class="panel"><header class="panel-head"><h3>Edições cadastradas</h3></header><div class="stack-list">${data.tournaments.map(c=>`<button class="league-row ${c.id===t?.id?'selected':''}" data-action="pickTourney" data-id="${c.id}"><div><strong>${htmlEscape(c.name)}</strong><small>${fmt(c.event_date)} • ${data.tournament_entries.filter(x=>x.tournament_id===c.id).length} clubes</small></div>${badge(c.status)}</button>`).join('')||notice('Sem campeonatos. Crie uma edição como administrador.')}</div></section>`;}
function matchCard(m){const done=m.status==='finalizada'; const score=done?`<div class="score">${m.home_goals}<span>:</span>${m.away_goals}</div>`:`<div class="score undecided">×</div>`;
return `<article class="match"><span class="match-meta">${stageNames[m.stage]}${m.group_code?' • Grupo '+m.group_code:''}${m.stage==='grupos'?' • Rodada '+m.round_no:''}</span><div class="match-body"><span class="match-team left">${team(m.home_club_id,true)}</span>${score}<span class="match-team right">${team(m.away_club_id,true)}</span></div>${done&&m.home_pen!=null?`<small class="pen-score">Pênaltis: ${m.home_pen} a ${m.away_pen}</small>`:''}<div class="match-actions">${isAdmin()?`<button class="button xsmall" data-action="score" data-id="${m.id}">Lançar placar</button>${done?`<button class="button xsmall" data-action="goal" data-id="${m.id}">Registrar gols</button>`:''}`:''}</div></article>`;}
function matchesView(){const t=tournament();if(!t)return sectionTitle('Partidas')+notice('Crie um campeonato para visualizar os confrontos.');const ms=data.matches.filter(m=>m.tournament_id===t.id);return `${sectionTitle('Partidas e chaveamento',`Regulamento COPOLLGA • ${t.name}`,`<div class="button-row">${selectedTourneyPicker()}${isAdmin()&&t.status!=='concluido'?'<button class="button gold" data-action="advance">Gerar próxima fase</button>':''}<button class="button" data-action="share">Compartilhar</button></div>`)}
 ${notice('1º de cada grupo avança direto; 2º × 3º cruzados disputam duas vagas na semifinal (6+ clubes). Depois: final, terceiro lugar e Copa-Louça. O perdedor da Copa-Louça lava a louça comum. Para 4–5 clubes, as semifinais são diretas.')}
 <div class="stage-track">${[['grupos','Grupos'],['playoffs','Playoffs'],['semifinais','Semifinais'],['finais','Finais'],['concluido','Concluído']].map(([s,n])=>`<div class="track-item ${s===t.status?'now':''}">${n}</div>`).join('')}</div>
 ${stageOrder.map(stage=>{const list=ms.filter(m=>m.stage===stage);if(!list.length)return '';return `<section class="panel"><header class="panel-head"><h3>${stageNames[stage]}</h3><span class="muted small">${list.length} ${list.length===1?'partida':'partidas'}</span></header><div class="matches-grid">${list.sort((a,b)=>a.round_no-b.round_no).map(matchCard).join('')}</div></section>`}).join('')||notice('Nenhum confronto gerado.')}<div class="caption">Os resultados só podem ser alterados pelo administrador. Para evitar chaves inconsistentes, placares de fases anteriores são bloqueados depois do avanço.</div>`;}
function standingsView(){const t=tournament();if(!t)return sectionTitle('Classificação')+notice('Sem campeonato.'); const r=data.group_standings.filter(x=>x.tournament_id===t.id);return `${sectionTitle('Classificação por grupos',`3 pontos por vitória, 1 pelo empate; desempate por saldo, gols pró, vitórias e nome.`,selectedTourneyPicker())}
 <div class="two-columns">${['A','B'].map(g=>`<section class="panel"><header class="panel-head"><h3>Grupo ${g}</h3><small>Confrontos internos • Ida</small></header><div class="table-overflow"><table><thead><tr><th>#</th><th>Clube</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th><th>Pts</th></tr></thead><tbody>${r.filter(x=>x.group_code===g).sort((a,b)=>a.placing-b.placing).map(x=>`<tr><td><span class="placement ${x.placing===1?'qualified':x.placing<=3?'playoff':''}">${x.placing}</span></td><td>${team(x.club_id,true)}</td><td>${x.played}</td><td>${x.wins}</td><td>${x.draws}</td><td>${x.losses}</td><td>${x.gd}</td><td><b>${x.points}</b></td></tr>`).join('')}</tbody></table></div></section>`).join('')}</div>${notice('Em grupos com 3 ou mais clubes, 1º direto à semifinal; 2º e 3º vão ao playoff cruzado. Em dias com 4–5 participantes, 1º e 2º jogam semifinais diretas.')}`;}
function clubsView(){const clubs=data.clubs,clubSel=selectedClub==='all'?clubs[0]?.id:selectedClub;const ps=data.players.filter(p=>p.club_id===clubSel&&p.name.toLowerCase().includes(playerSearch.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));const c=club(clubSel);
return `${sectionTitle('Clubes e elencos','Dados históricos recuperados do PES 2011. Confirme as transferências atuais e os atributos antes de oficializar.')}
<div class="club-strip compact">${clubs.map(x=>`<button class="club-icon clickable ${clubSel===x.id?'selected':''}" data-action="club" data-id="${x.id}">${crest(x.id,'large')}<small>${htmlEscape(x.abbr)}</small></button>`).join('')}</div><section class="panel"><header class="panel-head"><h3>${htmlEscape(c.name)} • ${ps.length} jogadores</h3><small>${c.coach_id?'Técnico: '+htmlEscape(person(c.coach_id).display_name):'Sem técnico atribuído'}</small></header><div class="panel-body"><label class="search-box">Buscar jogador<input id="searchPlayers" placeholder="Nome do jogador" value="${htmlEscape(playerSearch)}"/></label><div class="table-overflow"><table><thead><tr><th>Jogador</th><th>Posição</th><th>Camisa</th><th>Overall</th><th></th></tr></thead><tbody>${ps.map(p=>`<tr><td><strong>${htmlEscape(p.name)}</strong></td><td>${htmlEscape(p.position||'—')}</td><td>${p.shirt_no??'—'}</td><td>${p.overall??'—'}</td><td>${isAdmin()?`<button class="button xsmall" data-action="editPlayer" data-id="${p.id}">Editar</button>`:''}</td></tr>`).join('')||`<tr><td colspan="5">Nenhum jogador identificado neste clube.</td></tr>`}</tbody></table></div></div></section>`;}
function scorerStats(){const t=tournament();if(!t)return [];const matchLookup=new Map(data.matches.filter(x=>x.tournament_id===t.id&&x.stage!=='louca').map(x=>[x.id,x]));const totals=new Map();for(const row of data.match_goals){if(!matchLookup.has(row.match_id))continue;const p=player(row.player_id);const k=row.player_id;if(!totals.has(k))totals.set(k,{id:k,name:p.name,club_id:row.club_id,goals:0,games:0});const item=totals.get(k);item.goals+=row.goals;item.games+=1;}return [...totals.values()].sort((a,b)=>b.goals-a.goals||a.name.localeCompare(b.name));}
function scorersView(){const t=tournament();return `${sectionTitle('Artilharia',t?`Gols do campeonato ${t.name} (Copa-Louça separada)`:'Sem campeonato',t?selectedTourneyPicker():'')}
 <section class="panel"><header class="panel-head"><h3>Goleadores</h3></header><div class="table-overflow"><table><thead><tr><th>#</th><th>Jogador</th><th>Clube à época</th><th>Gols</th><th>Jogos com gol</th></tr></thead><tbody>${scorerStats().map((x,i)=>`<tr><td>${i+1}º</td><td><b>${htmlEscape(x.name)}</b></td><td>${team(x.club_id,true)}</td><td><b>${x.goals}</b></td><td>${x.games}</td></tr>`).join('')||'<tr><td colspan="5">Registre os autores dos gols nas partidas finalizadas.</td></tr>'}</tbody></table></div></section>`;}
function rankingStats(){const ranks=new Map(data.clubs.map(c=>[c.id,{club:c,points:0,first:0,second:0,third:0,lavagens:0}]));for(const t of data.tournaments.filter(x=>x.status==='concluido')){const ms=data.matches.filter(m=>m.tournament_id===t.id);const final=ms.find(m=>m.stage==='final'),third=ms.find(m=>m.stage==='terceiro'),louca=ms.find(m=>m.stage==='louca');if(!final||!third||!louca)continue;const champ=winner(final),vice=loser(final),bronze=winner(third),loucaLoser=loser(louca);if(champ){ranks.get(champ).points+=5;ranks.get(champ).first++;}if(vice){ranks.get(vice).points+=3;ranks.get(vice).second++;}if(bronze){ranks.get(bronze).points+=2;ranks.get(bronze).third++;}if(loucaLoser)ranks.get(loucaLoser).lavagens++;}return [...ranks.values()].sort((a,b)=>b.points-a.points||b.first-a.first||a.club.name.localeCompare(b.club.name));}
function rankingView(){return `${sectionTitle('Ranking geral COPOLLGA','Pontuação acumulada por campeonatos concluídos: campeão +5, vice +3 e terceiro +2.')}
${statsTiles([['+5','Campeão'],['+3','Vice-campeão'],['+2','Terceiro lugar'],[data.tournaments.filter(x=>x.status==='concluido').length,'Campeonatos concluídos']])}
<section class="panel"><header class="panel-head"><h3>Ranking histórico</h3></header><div class="table-overflow"><table><thead><tr><th>#</th><th>Clube</th><th>Pontos</th><th>🥇</th><th>🥈</th><th>🥉</th><th>🍽️</th></tr></thead><tbody>${rankingStats().map((x,i)=>`<tr><td>${i+1}º</td><td>${team(x.club.id,true)}</td><td><b>${x.points}</b></td><td>${x.first}</td><td>${x.second}</td><td>${x.third}</td><td>${x.lavagens}</td></tr>`).join('')}</tbody></table></div></section>`;}
function offersView(){const mine=myClubs();if(!offerFrom||(!isAdmin()&&!mine.some(c=>c.id===offerFrom)))offerFrom=isAdmin()?data.clubs[0]?.id:mine[0]?.id; if(!offerTo||offerTo===offerFrom)offerTo=data.clubs.find(c=>c.id!==offerFrom)?.id;
 const source=data.players.filter(p=>p.club_id===offerFrom);const target=data.players.filter(p=>p.club_id===offerTo);
 const proposalForm=canSendOffer()?`<section class="panel"><header class="panel-head"><h3>Nova proposta</h3></header><form id="newOfferForm" class="panel-body"><div class="form-grid"><label>Seu clube <select id="offerFrom" name="from" ${isAdmin()?'':'disabled'}>${(isAdmin()?data.clubs:mine).map(c=>`<option value="${c.id}" ${c.id===offerFrom?'selected':''}>${htmlEscape(c.name)}</option>`).join('')}</select></label><label>Clube destinatário<select id="offerTo" name="to">${data.clubs.filter(c=>c.id!==offerFrom).map(c=>`<option value="${c.id}" ${c.id===offerTo?'selected':''}>${htmlEscape(c.name)}</option>`).join('')}</select></label><label>Jogador oferecido<select name="player" required>${source.map(p=>`<option value="${p.id}">${htmlEscape(p.name)}</option>`).join('')}</select></label><label>Jogador recebido (opcional para troca)<select name="swap"><option value="">Sem troca — transferência direta</option>${target.map(p=>`<option value="${p.id}">${htmlEscape(p.name)}</option>`).join('')}</select></label></div><button class="button gold" type="submit">Enviar proposta</button><p class="muted small">A proposta só altera os elencos após aceite do clube destinatário e homologação da administração.</p></form></section>`:'';
 return `${sectionTitle('Mercado de transferências','Técnico envia → destinatário responde → administração homologa.')}${proposalForm}<section class="panel"><header class="panel-head"><h3>Negociações</h3></header><div class="stack-list">${data.transfer_offers.slice().sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(o=>{const receiver=myClubs().some(c=>c.id===o.to_club_id);return `<div class="offer-row"><div><strong>${htmlEscape(player(o.player_id).name)}</strong> ${o.swap_player_id?`⇄ <strong>${htmlEscape(player(o.swap_player_id).name)}</strong>`:'→ transferência'}<small>${htmlEscape(club(o.from_club_id).name)} → ${htmlEscape(club(o.to_club_id).name)} • ${new Date(o.created_at).toLocaleDateString('pt-BR')}</small></div><div class="button-row">${badge(o.status)}${o.status==='pendente'&&(receiver||isAdmin())?`<button class="button xsmall" data-action="respondOffer" data-id="${o.id}" data-accept="true">Aceitar</button><button class="button xsmall" data-action="respondOffer" data-id="${o.id}" data-accept="false">Recusar</button>`:''}${o.status==='aceita'&&isAdmin()?`<button class="button gold xsmall" data-action="approveOffer" data-id="${o.id}">Homologar</button>`:''}</div></div>`}).join('')||notice('Nenhuma transferência proposta.')}</div></section>`;}
function adminView(){if(!isAdmin())return notice('Apenas administradores.');return `${sectionTitle('Administração da liga','Vincule os técnicos cadastrados aos clubes e consulte as contas autorizadas.')}
 ${notice('Os usuários criam a própria conta por e-mail. Para manter o sistema seguro, a primeira permissão de administrador deve ser concedida pelo SQL Editor do Supabase. Técnicos NÃO podem se promover a administradores.')}
 <section class="panel"><header class="panel-head"><h3>Responsáveis pelos clubes</h3></header><div class="panel-body"><div class="assign-grid">${data.clubs.map(c=>`<form class="assign-row" data-form="assignCoach"><span>${team(c.id,true)}</span><input type="hidden" name="club" value="${c.id}"/><select name="coach"><option value="">Sem técnico</option>${data.profiles.filter(p=>!p.is_admin).map(p=>`<option value="${p.id}" ${c.coach_id===p.id?'selected':''}>${htmlEscape(p.display_name)} (${p.id.slice(0,6)})</option>`).join('')}</select><button class="button xsmall" type="submit">Salvar</button></form>`).join('')}</div></div></section>`;}
function render(){if(!currentUser)return renderAuth();const view=({home:homeView,tournaments:tournamentsView,matches:matchesView,standings:standingsView,scorers:scorersView,clubs:clubsView,offers:offersView,ranking:rankingView,admin:adminView})[page]||homeView;appRoot().innerHTML=appShell(view());}
function renderAuth(){appRoot().innerHTML=`<div class="auth-page"><div class="auth-left"><img src="${logo}" alt="Emblema oficial original COPOLLGA"/><h1>A LIGA É NOSSA.</h1><p>Campeonatos. Clubes. Transferências. Um só lugar, em todos os celulares.</p></div><main class="auth-card"><span class="eyebrow">COPOLLGA 6.0 — ONLINE</span><h2>Entre para a liga</h2><p>Utilize sua conta. O administrador definirá qual clube você poderá gerenciar.</p><div class="auth-tabs"><button class="active" data-action="authTab" data-tab="login">Entrar</button><button data-action="authTab" data-tab="signup">Criar conta</button></div><form id="authForm"><div id="nameField" style="display:none"><label>Nome exibido<input name="displayName" placeholder="Seu nome" autocomplete="nickname"/></label></div><label>E-mail<input name="email" type="email" required autocomplete="email" placeholder="voce@exemplo.com" /></label><label>Senha<input name="password" type="password" required minlength="6" autocomplete="current-password" placeholder="Mínimo de 6 caracteres" /></label><input name="authMode" type="hidden" value="login"/><button type="submit" class="button gold block">Entrar na COPOLLGA</button></form><div class="caption">Suas credenciais são tratadas pelo Supabase Auth, não pelo ChatGPT. Acesso online exige conexão.</div></main></div>${alertHtml()}`;}
function renderNotConfigured(){appRoot().innerHTML=`<main class="setup-page"><img src="${logo}" alt="Emblema oficial COPOLLGA"/><h1>COPOLLGA 6.0 — preparada para a internet</h1><p>O código está pronto para configurar. Ainda faltam as credenciais públicas do banco de dados do organizador.</p><section class="panel"><div class="panel-body"><h3>Para ativar</h3><ol><li>Crie um projeto no Supabase.</li><li>Execute os arquivos SQL da pasta <code>sql</code> na ordem indicada.</li><li>Abra <code>site/config.js</code> e preencha URL e chave pública.</li><li>Publique a pasta <code>site</code> numa hospedagem HTTPS.</li><li>Cadastre a conta administradora e atribua a permissão no SQL Editor.</li></ol><p><b>Não use a chave secreta service_role.</b> Leia <code>GUIA_INSTALACAO.md</code> no ZIP.</p></div></section></main>`;}
function modal(content){const host=$('#modalHost'); if(host)host.innerHTML=`<div class="modal-overlay" data-action="closeModal"><div class="modal-card" role="dialog" aria-modal="true" onclick="event.stopPropagation()"><button class="modal-close" aria-label="Fechar" data-action="closeModal">✕</button>${content}</div></div>`;}
function closeModal(){const host=$('#modalHost');if(host)host.innerHTML='';}
function editScore(id){const m=data.matches.find(x=>x.id===id);if(!m)return;const t=data.tournaments.find(x=>x.id===m.tournament_id);if(t?.status==='concluido'||(m.stage==='grupos'&&t.status!=='grupos')||(m.stage==='playoff'&&t.status!=='playoffs')||(m.stage==='semi'&&t.status!=='semifinais')){inform('Fase já avançou. O placar está bloqueado para preservar o chaveamento.','error');return;}
modal(`<h2>Resultado da partida</h2><p class="muted">${htmlEscape(club(m.home_club_id).name)} × ${htmlEscape(club(m.away_club_id).name)}</p><form id="scoreForm"><input type="hidden" name="id" value="${id}"/><div class="form-grid"><label>Gols ${htmlEscape(club(m.home_club_id).abbr)}<input type="number" name="home" min="0" max="99" required value="${m.home_goals??0}"/></label><label>Gols ${htmlEscape(club(m.away_club_id).abbr)}<input type="number" name="away" min="0" max="99" required value="${m.away_goals??0}"/></label></div>${m.stage==='grupos'?'':`<p class="muted small">Em caso de empate no mata-mata, informe os pênaltis para definir quem avança.</p><div class="form-grid"><label>Pênaltis mandante<input type="number" name="homepen" min="0" max="99" value="${m.home_pen??''}"/></label><label>Pênaltis visitante<input type="number" name="awaypen" min="0" max="99" value="${m.away_pen??''}"/></label></div>`}<button class="button gold block" type="submit">Salvar resultado</button></form>`);
}
function editPlayer(id){const p=data.players.find(x=>x.id===id);if(!p)return;modal(`<h2>Editar atleta</h2><p class="muted">${htmlEscape(p.name)} • ${htmlEscape(club(p.club_id).name)}</p><form id="playerForm"><input name="id" type="hidden" value="${p.id}"/><label>Posição<input name="position" placeholder="Ex.: ZAG, MEI, ATA" value="${htmlEscape(p.position||'')}"/></label><div class="form-grid"><label>Camisa<input name="shirt" type="number" min="1" max="99" value="${p.shirt_no??''}" /></label><label>Overall<input name="overall" type="number" min="1" max="99" value="${p.overall??''}" /></label></div><button class="button gold block">Salvar atleta</button></form>`);}
function editGoals(id){const m=data.matches.find(x=>x.id===id);if(!m||m.status!=='finalizada')return;goalClub=m.home_club_id;
const goalsFor=(x)=>data.match_goals.filter(g=>g.match_id===id&&g.club_id===x).map(g=>`${htmlEscape(player(g.player_id).name)} ${g.goals}`).join(' · ')||'—';
const playersFor=data.players.filter(p=>p.club_id===goalClub);
modal(`<h2>Artilheiros da partida</h2><p class="muted">${htmlEscape(club(m.home_club_id).name)} ${m.home_goals} × ${m.away_goals} ${htmlEscape(club(m.away_club_id).name)}</p><p class="muted small">${htmlEscape(club(m.home_club_id).abbr)}: ${goalsFor(m.home_club_id)}<br/>${htmlEscape(club(m.away_club_id).abbr)}: ${goalsFor(m.away_club_id)}</p><form id="goalForm"><input type="hidden" name="match" value="${id}"/><label>Clube<select id="goalClub" name="club"><option value="${m.home_club_id}">${htmlEscape(club(m.home_club_id).name)}</option><option value="${m.away_club_id}">${htmlEscape(club(m.away_club_id).name)}</option></select></label><label>Jogador<select name="player" id="goalPlayer">${playersFor.map(p=>`<option value="${p.id}">${htmlEscape(p.name)}</option>`).join('')}</select></label><label>Gols marcados<input type="number" name="goals" min="1" max="30" value="1" required/></label><button class="button gold block">Salvar gols deste jogador</button></form><p class="muted small">Para remover um registro já lançado, use o botão Apagar abaixo.</p><div class="goal-tags">${data.match_goals.filter(g=>g.match_id===id).map(g=>`<button class="button xsmall" data-action="deleteGoal" data-match="${id}" data-player="${g.player_id}">Apagar ${htmlEscape(player(g.player_id).name)} (${g.goals})</button>`).join('')}</div>`);}

async function loadData(shouldRender=true){if(!sb||!currentUser)return;if(busy)return;busy=true;
 try{
 const names=['profiles','clubs','players','tournaments','tournament_entries','matches','match_goals','transfer_offers','group_standings'];
 const results=await Promise.all(names.map(name=>sb.from(name).select('*')));
 results.forEach((res,i)=>{if(res.error)throw new Error(`${names[i]}: ${res.error.message}`);});
 const next={};names.forEach((name,i)=>next[name]=results[i].data||[]);
 data=next;
 data.tournaments.sort((a,b)=>(b.event_date||'').localeCompare(a.event_date||'')||b.created_at.localeCompare(a.created_at));
 if(!tournament())selectedTournament=data.tournaments[0]?.id||null;
 if(shouldRender)render();
 }catch(error){if(!$('#toast')){appRoot().innerHTML=`<main class="setup-page"><h2>Falha ao conectar ao banco</h2><p>${htmlEscape(error.message)}</p><p>Confira se o SQL foi executado e se a chave pública corresponde a este projeto.</p><button class="button" onclick="location.reload()">Tentar novamente</button></main>`;}else inform('Falha ao consultar o banco: '+error.message,'error');}
 finally{busy=false;}
}
async function handleAuthentication(form){const mode=form.elements.authMode.value;
const email=form.elements.email.value.trim(), password=form.elements.password.value;
if(!email||password.length<6)return inform('Preencha e-mail e senha de pelo menos 6 caracteres.','error');
try{if(mode==='signup'){
 const displayName=form.elements.displayName.value.trim();if(!displayName)return inform('Informe seu nome.','error');
 const {data:result,error}=await sb.auth.signUp({email,password,options:{data:{display_name:displayName},emailRedirectTo:window.location.origin+window.location.pathname}});if(error)throw error;
 inform(result.session?'Conta criada e autenticada.':'Conta solicitada! Confirme seu e-mail e depois entre.');
}else{const {data:result,error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;currentUser=result.user;await loadData();}
}catch(e){inform(e.message,'error');}}
async function request(fn,successText){try{const result=await fn();if(result?.error)throw result.error;await loadData();if(successText)inform(successText);return result?.data ?? true;}catch(e){inform(e.message,'error');return null;}}
async function saveResult(form){const m=data.matches.find(x=>x.id===form.elements.id.value);if(!m)return;const h=Number(form.elements.home.value),a=Number(form.elements.away.value);
if(!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0||h>99||a>99)return inform('Informe placares entre 0 e 99.','error');
const tied=h===a&&m.stage!=='grupos';const ph=form.elements.homepen?.value,pa=form.elements.awaypen?.value;
if(tied&&(ph===''||pa===''||Number(ph)===Number(pa)))return inform('Em empate eliminatório, informe pênaltis diferentes.','error');
// Não permitir placar menor que gols de atletas já registrados.
const claimed=(cid)=>data.match_goals.filter(x=>x.match_id===m.id&&x.club_id===cid).reduce((n,g)=>n+g.goals,0);
if(h<claimed(m.home_club_id)||a<claimed(m.away_club_id))return inform('O placar não pode ser menor que os gols atribuídos aos atletas.','error');
const result=await request(()=>sb.from('matches').update({home_goals:h,away_goals:a,home_pen:tied?Number(ph):null,away_pen:tied?Number(pa):null,status:'finalizada'}).eq('id',m.id).select('id').single(),'Placar salvo e sincronizado.');if(result!==null){closeModal();}
}
async function createTourney(form){const checked=[...form.querySelectorAll('input[name="clubs"]:checked')].map(x=>x.value);if(checked.length<4||checked.length>10)return inform('Selecione de 4 a 10 clubes.','error');
const name=form.elements.name.value.trim(),eventDate=form.elements.date.value;
if(!name||!eventDate)return inform('Informe nome e data.','error');
const value=await request(()=>sb.rpc('create_copollga_tournament',{p_name:name,p_date:eventDate,p_clubs:checked}),'Grupos sorteados e partidas geradas.');if(value){selectedTournament=value;localStorage.setItem(storageTournament,value);page='matches';render();}}
async function advance(){const t=tournament();if(!t)return;await request(()=>sb.rpc('advance_copollga_tournament',{p_tid:t.id}),'Próxima fase gerada.');}
async function offer(form){const from=isAdmin()?form.elements.from.value:myClubs()[0]?.id;const to=form.elements.to.value;
const playerId=form.elements.player.value;const swap=form.elements.swap.value||null;
if(!from||!to||from===to||!playerId)return inform('Selecione clubes distintos e um jogador.','error');
await request(()=>sb.from('transfer_offers').insert({from_club_id:from,to_club_id:to,player_id:playerId,swap_player_id:swap,created_by:currentUser.id,status:'pendente'}),'Proposta enviada ao outro técnico.');}
function textReport(){const t=tournament();if(!t)return 'COPOLLGA — sem campeonatos cadastrados';let s=`🏆 COPOLLGA • ${t.name}\n📅 ${fmt(t.event_date)}\n\n`;
for(const g of ['A','B']){s+=`GRUPO ${g}\n`;data.group_standings.filter(x=>x.tournament_id===t.id&&x.group_code===g).sort((a,b)=>a.placing-b.placing).forEach(x=>s+=`${x.placing}º ${x.club_name}: ${x.points} pts (${x.gd>=0?'+':''}${x.gd} SG)\n`);s+='\n';}
for(const m of data.matches.filter(x=>x.tournament_id===t.id))s+=`${stageNames[m.stage]}: ${club(m.home_club_id).abbr} ${m.status==='finalizada'?m.home_goals:'-'} x ${m.status==='finalizada'?m.away_goals:'-'} ${club(m.away_club_id).abbr}${m.home_pen!=null?` (pên. ${m.home_pen}-${m.away_pen})`:''}\n`;
return s+'\n🥇 5 pts • 🥈 3 pts • 🥉 2 pts\n🍽️ Quem perde a Copa-Louça lava a louça!';}
async function share(){const s=textReport();try{if(navigator.share){await navigator.share({title:'COPOLLGA — resultados',text:s});return;}await navigator.clipboard.writeText(s);inform('Resumo copiado para compartilhar no WhatsApp.');}catch(e){if(e.name!=='AbortError')inform('Não foi possível compartilhar: '+e.message,'error');}}

document.addEventListener('click',async event=>{const btn=event.target.closest('[data-action]');if(!btn)return;const action=btn.dataset.action;
try{switch(action){
 case 'nav':page=btn.dataset.page;render();break;
 case 'logout':await sb.auth.signOut();currentUser=null;renderAuth();break;
 case 'refresh':await loadData();inform('Dados atualizados.');break;
 case 'pickTourney':selectedTournament=btn.dataset.id;localStorage.setItem(storageTournament,selectedTournament);page='matches';render();break;
 case 'club':selectedClub=btn.dataset.id;playerSearch='';render();break;
 case 'advance':if(confirm('Gerar a próxima fase com base nos resultados lançados?'))await advance();break;
 case 'score':editScore(btn.dataset.id);break;
 case 'editPlayer':editPlayer(btn.dataset.id);break;
 case 'goal':editGoals(btn.dataset.id);break;
 case 'closeModal':closeModal();break;
 case 'share':await share();break;
 case 'respondOffer':await request(()=>sb.rpc('respond_transfer',{p_offer:btn.dataset.id,p_accept:btn.dataset.accept==='true'}),'Resposta registrada.');break;
 case 'approveOffer':if(confirm('Homologar e movimentar os jogadores entre os clubes?'))await request(()=>sb.rpc('homologate_transfer',{p_offer:btn.dataset.id}),'Transferência homologada.');break;
 case 'deleteGoal':if(confirm('Apagar este registro de gols?')){await request(()=>sb.from('match_goals').delete().eq('match_id',btn.dataset.match).eq('player_id',btn.dataset.player),'Gols apagados.');closeModal();}break;
 case 'authTab':{const signup=btn.dataset.tab==='signup';$('#authForm').elements.authMode.value=signup?'signup':'login';$('#nameField').style.display=signup?'block':'none';document.querySelectorAll('.auth-tabs button').forEach(x=>x.classList.toggle('active',x===btn));$('#authForm button[type="submit"]').textContent=signup?'Criar minha conta':'Entrar na COPOLLGA';break;}
 }}catch(e){inform(e.message,'error');}
});

document.addEventListener('change',event=>{const target=event.target;if(target.id==='tournamentPicker'){selectedTournament=target.value;localStorage.setItem(storageTournament,selectedTournament);render();}
else if(target.id==='offerFrom'){offerFrom=target.value;offerTo=data.clubs.find(c=>c.id!==offerFrom)?.id;render();}
else if(target.id==='offerTo'){offerTo=target.value;render();}
else if(target.id==='goalClub'){const select=$('#goalPlayer');if(select)select.innerHTML=data.players.filter(p=>p.club_id===target.value).map(p=>`<option value="${p.id}">${htmlEscape(p.name)}</option>`).join('');}
});
document.addEventListener('input',event=>{if(event.target.id==='searchPlayers'){playerSearch=event.target.value;const at=event.target.selectionStart;render();const next=$('#searchPlayers');if(next){next.focus();next.setSelectionRange(at,at);}}});
document.addEventListener('submit',async event=>{const form=event.target;if(!(form instanceof HTMLFormElement))return;const formId=form.getAttribute('id')||'';if(!formId&&!form.dataset.form)return;event.preventDefault();
if(formId==='authForm'){await handleAuthentication(form);return;}
if(!currentUser)return;
if(formId==='createTournamentForm'){await createTourney(form);return;}
if(formId==='scoreForm'){await saveResult(form);return;}
if(formId==='newOfferForm'){await offer(form);return;}
if(formId==='playerForm'){
const id=form.elements.id.value; const pos=form.elements.position.value.trim()||null;
const shirt=form.elements.shirt.value===''?null:Number(form.elements.shirt.value),overall=form.elements.overall.value===''?null:Number(form.elements.overall.value);
await request(()=>sb.from('players').update({position:pos,shirt_no:shirt,overall:overall}).eq('id',id),'Jogador atualizado.');closeModal();return;}
if(formId==='goalForm'){
const mid=form.elements.match.value,pid=form.elements.player.value,cid=form.elements.club.value,goals=Number(form.elements.goals.value);
const m=data.matches.find(x=>x.id===mid);if(!m)return;
const cap=cid===m.home_club_id?m.home_goals:m.away_goals;
const claimed=data.match_goals.filter(g=>g.match_id===mid&&g.club_id===cid&&g.player_id!==pid).reduce((n,g)=>n+g.goals,0);
if(!Number.isInteger(goals)||goals<1||goals>30||claimed+goals>cap)return inform('A soma dos gols atribuídos não pode superar o placar do clube.','error');
await request(()=>sb.from('match_goals').upsert({match_id:mid,player_id:pid,club_id:cid,goals},{onConflict:'match_id,player_id'}),'Gols do atleta registrados.');closeModal();return;}
if(form.dataset.form==='assignCoach'){
const clubId=form.elements.club.value,coachId=form.elements.coach.value||null;
await request(()=>sb.from('clubs').update({coach_id:coachId}).eq('id',clubId),'Técnico vinculado ao clube.');return;}
});

async function boot(){if(!configured){renderNotConfigured();return;}
try{const {data:{session},error}=await sb.auth.getSession();if(error)throw error;currentUser=session?.user||null;
if(currentUser)await loadData();else renderAuth();
sb.auth.onAuthStateChange(async(event,session)=>{
 if(event==='SIGNED_OUT'){currentUser=null;data={profiles:[],clubs:[],players:[],tournaments:[],tournament_entries:[],matches:[],match_goals:[],transfer_offers:[],group_standings:[]};renderAuth();}
 if(event==='SIGNED_IN'&&session?.user&&session.user.id!==currentUser?.id){currentUser=session.user;await loadData();}
});
timer=setInterval(()=>{if(currentUser&&document.visibilityState==='visible'&&!$('#modalHost')?.children?.length&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)){loadData();}},30000);
}catch(e){appRoot().innerHTML=`<main class="setup-page"><h2>Erro ao conectar</h2><p>${htmlEscape(e.message)}</p><p>Verifique site/config.js e a configuração do Supabase.</p></main>`;}}
boot();
