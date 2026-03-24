/* ═══════════════════════════════════════════════════════
   app.js — Mapa Estafeta Pro  |  Mobile-First
   ═══════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────
   1. Estilos constantes
   ───────────────────────────────────────────────────── */
var ESTILO_NORMAL      = { color: 'blue',  weight: 8,  opacity: 0.6 };
var ESTILO_DESTAQUE    = { color: 'yellow', weight: 8,  opacity: 0.6 };
var ESTILO_SELECIONADO = { color: 'blue',  weight: 10, opacity: 0.6 };

/* ─────────────────────────────────────────────────────
   2. Camadas base
   ───────────────────────────────────────────────────── */
var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 22, attribution: '© OpenStreetMap'
});
var googleSatCompleto = L.layerGroup([
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 22, subdomains: ['mt0','mt1','mt2','mt3']
    }),
    L.tileLayer('https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
        maxZoom: 22, subdomains: ['mt0','mt1','mt2','mt3']
    })
]);

/* ─────────────────────────────────────────────────────
   3. Estado global
   ───────────────────────────────────────────────────── */
var minhasRuas   = L.layerGroup();
var ruas         = {};
var ruasIndex    = [];
var linhaClicada = null;
var camadaAtiva  = 'sat';
var ruasVisiveis = false;

/* ─────────────────────────────────────────────────────
   4. Mapa
   ───────────────────────────────────────────────────── */
var map = L.map('map', {
    zoomControl: false, fadeAnimation: false,
    center: [41.66, -8.47], zoom: 12.5,
    layers: [googleSatCompleto],
    inertiaDeceleration: 3000, tap: false
});
// minhasRuas só é adicionado ao mapa quando o utilizador o ativar

/* ─────────────────────────────────────────────────────
   5. Popup reutilizável
   ───────────────────────────────────────────────────── */
var popupFlutuante = L.popup({
    closeButton: false,
    className: 'popup-container',
    offset: [0, -10],
    autoPan: false
});

map.on('click', function () {
    setVisible(suggestionsMenu, false);
    setVisible(layerPanel, false);
    if (linhaClicada) { linhaClicada.setStyle(ESTILO_NORMAL); linhaClicada = null; }
    map.closePopup();
});

/* ─────────────────────────────────────────────────────
   6. Utilitários DOM
   ───────────────────────────────────────────────────── */
function setVisible(el, v) { el.classList.toggle('visible', !!v); }
function setSearchActive(a) { searchButton.classList.toggle('has-active-search', a); }

function tap(el, fn) {
    el.addEventListener('click', fn);
    el.addEventListener('touchend', function(e) { e.preventDefault(); fn.call(this, e); });
}

var searchContainer = document.querySelector('.search-container');
var searchButton    = document.getElementById('search-button');
var searchInput     = document.getElementById('search');
var clearBtn        = document.getElementById('clear-search');
var suggestionsMenu = document.getElementById('suggestions');
var layerToggleBtn  = document.getElementById('layer-toggle-btn');
var layerPanel      = document.getElementById('layer-panel');
var toastEl         = document.getElementById('toast-copiado');
var toastTimer      = null;

/* ─────────────────────────────────────────────────────
   7. Layer toggle
   ───────────────────────────────────────────────────── */
tap(layerToggleBtn, function(e) {
    e.stopPropagation();
    setVisible(layerPanel, !layerPanel.classList.contains('visible'));
    setVisible(suggestionsMenu, false);
});
layerPanel.addEventListener('click', function(e) { e.stopPropagation(); });
layerPanel.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: true });

tap(document.getElementById('lr-osm'), function() {
    if (camadaAtiva === 'osm') return;
    map.removeLayer(googleSatCompleto); map.addLayer(osm); camadaAtiva = 'osm';
    document.getElementById('radio-osm').classList.add('checked');
    document.getElementById('radio-sat').classList.remove('checked');
    setVisible(layerPanel, false);
});
tap(document.getElementById('lr-sat'), function() {
    if (camadaAtiva === 'sat') return;
    map.removeLayer(osm); map.addLayer(googleSatCompleto); camadaAtiva = 'sat';
    document.getElementById('radio-sat').classList.add('checked');
    document.getElementById('radio-osm').classList.remove('checked');
    setVisible(layerPanel, false);
});
tap(document.getElementById('lr-ruas'), function() {
    ruasVisiveis = !ruasVisiveis;
    document.getElementById('check-ruas').classList.toggle('checked', ruasVisiveis);
    if (ruasVisiveis) minhasRuas.addTo(map);
    else { map.removeLayer(minhasRuas); map.closePopup(); }
    setVisible(layerPanel, false);
});

/* ─────────────────────────────────────────────────────
   8. Search UI
   ───────────────────────────────────────────────────── */
tap(searchButton, function() {
    searchContainer.classList.add('expanded');
    setVisible(layerPanel, false);
    searchInput.focus();
    setVisible(clearBtn, searchInput.value.trim() !== '');
    if (searchInput.value.trim()) searchInput.dispatchEvent(new Event('input'));
});

var _skipBlurCollapse = false;

searchInput.addEventListener('blur', function() {
    setTimeout(function() {
        if (_skipBlurCollapse) { _skipBlurCollapse = false; return; }
        if (suggestionsMenu.contains(document.activeElement)) return;
        searchContainer.classList.remove('expanded');
        setVisible(suggestionsMenu, false);
        if (searchInput.value.trim()) { setVisible(clearBtn, false); setSearchActive(true); }
        else { setVisible(clearBtn, false); setSearchActive(false); }
    }, 200);
});

/* ─────────────────────────────────────────────────────
   9. Popup conteúdo
   ───────────────────────────────────────────────────── */
function criarConteudoPopup(nome, pontosArray) {
    var container = document.createElement('div');
    container.innerHTML = '<b>' + nome + '</b><br>';

    var btn = document.createElement('button');
    btn.textContent = 'Copiar coordenadas';
    btn.className = 'btn-copiar';

    var meio = pontosArray[Math.floor(pontosArray.length / 2)].split(',');
    var coord = meio[1] + ',' + meio[0];

    btn.addEventListener('click', function(e) { e.stopPropagation(); copiarCoordenadas(coord); });
    btn.addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); copiarCoordenadas(coord); });
    container.addEventListener('click', function(e) { e.stopPropagation(); });
    container.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: true });
    container.appendChild(btn);
    return container;
}

function copiarCoordenadas(coord) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(coord)
            .then(function() { mostrarToast('Copiado✓'); })
            .catch(function() { copiarManualmente(coord); });
    } else { copiarManualmente(coord); }
}
function copiarManualmente(texto) {
    var ta = document.createElement('textarea');
    ta.value = texto; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); mostrarToast('✓ Copiado!'); }
    catch(_) { mostrarToast('Erro ao copiar'); }
    document.body.removeChild(ta);
}

/* ─────────────────────────────────────────────────────
   10. Toast
   ───────────────────────────────────────────────────── */
function mostrarToast(msg) {
    toastEl.textContent = msg; toastEl.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { toastEl.style.display = 'none'; }, 2000);
}

/* ─────────────────────────────────────────────────────
   11. Carregar KML
   ───────────────────────────────────────────────────── */
function carregarKML(url) {
    return fetch(url)
        .then(function(r) { return r.text(); })
        .then(function(data) {
            var xml = new DOMParser().parseFromString(data, 'text/xml');
            var placemarks = xml.getElementsByTagName('Placemark');

            for (var i = 0; i < placemarks.length; i++) {
                var p    = placemarks[i];
                var nome = p.getElementsByTagName('name')[0].textContent;
                var raw  = p.getElementsByTagName('coordinates')[0].textContent.trim();
                var pts  = raw.split(/\s+/);
                var coords = pts.map(function(pt) {
                    var c = pt.split(','); return [parseFloat(c[1]), parseFloat(c[0])];
                });

                var line = L.polyline(coords, ESTILO_NORMAL).addTo(minhasRuas);
                line.pontosArray = pts;
                line.nomeRua = nome;

                line.on('mouseover', function(e) {
                    if (this === linhaClicada) return;
                    this.setStyle(ESTILO_DESTAQUE);
                    popupFlutuante.setLatLng(e.latlng)
                        .setContent(criarConteudoPopup(this.nomeRua, this.pontosArray))
                        .openOn(map);
                });
                line.on('mouseout', function() {
                    if (this === linhaClicada) return;
                    this.setStyle(ESTILO_NORMAL); map.closePopup();
                });
                line.on('click', function(e) {
                    L.DomEvent.stopPropagation(e);
                    if (linhaClicada && linhaClicada !== this) linhaClicada.setStyle(ESTILO_NORMAL);
                    linhaClicada = this; this.setStyle(ESTILO_DESTAQUE);
                    popupFlutuante.setLatLng(e.latlng)
                        .setContent(criarConteudoPopup(this.nomeRua, this.pontosArray))
                        .openOn(map);
                });
                ruas[nome] = line;
            }
        })
        .catch(function(err) { console.error('Erro ao ler KML:', err); });
}

/* ═══════════════════════════════════════════════════════
   12. Motor de pesquisa híbrido (tokens + Fuse.js)
   ═══════════════════════════════════════════════════════ */
var fuse = null;

var STOPWORDS = new Set(['rua','r','av','avenida','largo','travessa','beco',
    'estrada','calcada','caminho','quinta','de','da','do','das','dos',
    'e','em','a','o','as','os','um','uma']);

function normalizar(t) {
    return t.toLowerCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ').trim();
}

function inicializarPesquisa() {
    ruasIndex = Object.keys(ruas).map(function(nome) {
        var norm = normalizar(nome);
        var tokens = norm.split(' ').filter(function(w) {
            return w.length >= 2 && !STOPWORDS.has(w);
        });
        return { name: nome, norm: norm, tokens: tokens };
    });

    fuse = new Fuse(ruasIndex, {
        keys: ['norm'], threshold: 0.42, distance: 200,
        ignoreLocation: true, includeScore: true,
        minMatchCharLength: 2, shouldSort: true
    });
}

/* Passe 1: correspondência por tokens */
function pesquisaPorTokens(queryNorm) {
    var qTokens = queryNorm.split(' ').filter(function(w) {
        return w.length >= 2 && !STOPWORDS.has(w);
    });
    if (!qTokens.length) return [];

    var resultados = [];
    for (var i = 0; i < ruasIndex.length; i++) {
        var entrada = ruasIndex[i];
        var matches = 0;
        for (var j = 0; j < qTokens.length; j++) {
            var qt = qTokens[j];
            for (var k = 0; k < entrada.tokens.length; k++) {
                if (entrada.tokens[k].indexOf(qt) !== -1 || qt.indexOf(entrada.tokens[k]) !== -1) {
                    matches++; break;
                }
            }
        }
        if (matches / qTokens.length >= 0.5) {
            resultados.push({ item: entrada, score: 1 - (matches / qTokens.length) });
        }
    }
    return resultados;
}

/* Merge: tokens têm prioridade, fuse complementa */
function pesquisar(textoOriginal) {
    if (!fuse || !textoOriginal.trim()) return [];
    var queryNorm = normalizar(textoOriginal);

    var tokenResults = pesquisaPorTokens(queryNorm);
    var fuseResults  = fuse.search(queryNorm)
        .filter(function(r) { return r.score < 0.45; })
        .map(function(r) { return { item: r.item, score: r.score }; });

    var seen = {}, merged = [];
    tokenResults.forEach(function(r) { seen[r.item.name] = true; merged.push(r); });
    fuseResults.forEach(function(r) {
        if (!seen[r.item.name]) { seen[r.item.name] = true; merged.push(r); }
    });
    merged.sort(function(a, b) { return a.score - b.score; });
    return merged.slice(0, 6);
}

/* Sublinha as partes encontradas */
function highlightNome(nome, queryNorm) {
    var words = queryNorm.split(' ').filter(function(w) { return w.length >= 2; });
    var nomeNorm = normalizar(nome);
    var result = nome;
    words.forEach(function(w) {
        var idx = nomeNorm.indexOf(w);
        if (idx === -1) return;
        var original = nome.substring(idx, idx + w.length);
        result = result.replace(original, '<mark>' + original + '</mark>');
    });
    return result;
}

searchInput.addEventListener('input', function() {
    var original = this.value;
    suggestionsMenu.innerHTML = '';

    if (!original) {
        setVisible(clearBtn, false); setVisible(suggestionsMenu, false);
        setSearchActive(false); resetMap(); return;
    }
    setVisible(clearBtn, true);
    if (!fuse) return;

    var results = pesquisar(original);

    if (results.length) {
        var queryNorm = normalizar(original);
        var frag = document.createDocumentFragment();
        results.forEach(function(r) {
            var div = document.createElement('div');
            div.className = 'suggestion-item';
            div.setAttribute('role', 'option');

            var icon = document.createElement('span');
            icon.className = 'suggestion-icon';
            icon.innerHTML = '<i class="fas fa-road"></i>';

            var text = document.createElement('div');
            text.className = 'suggestion-text';
            var name = document.createElement('div');
            name.className = 'suggestion-name';
            name.innerHTML = highlightNome(r.item.name, queryNorm);
            text.appendChild(name);

            div.appendChild(icon);
            div.appendChild(text);
            div.addEventListener('click', function() { selecionarRua(r.item.name); });
            div.addEventListener('touchend', function(e) { e.preventDefault(); selecionarRua(r.item.name); });
            frag.appendChild(div);
        });
        suggestionsMenu.appendChild(frag);
        setVisible(suggestionsMenu, true);
    } else {
        var empty = document.createElement('div');
        empty.style.cssText = 'padding:14px 16px;font-size:13px;color:#888;text-align:center;';
        empty.textContent = 'Sem resultados para "' + original + '"';
        suggestionsMenu.appendChild(empty);
        setVisible(suggestionsMenu, true);
    }
});

function selecionarRua(nome) {
    searchInput.value = nome;
    setVisible(suggestionsMenu, false);
    map.closePopup();
    if (linhaClicada) { linhaClicada.setStyle(ESTILO_NORMAL); linhaClicada = null; }
    Object.keys(ruas).forEach(function(r) {
        if (r === nome) {
            if (!minhasRuas.hasLayer(ruas[r])) minhasRuas.addLayer(ruas[r]);
            ruas[r].setStyle(ESTILO_SELECIONADO);
            minhasRuas.addTo(map);
            map.fitBounds(ruas[r].getBounds(), { padding: [50,50], maxZoom: 16 });
        } else {
            minhasRuas.removeLayer(ruas[r]);
        }
    });
    setTimeout(function() { searchInput.blur(); }, 300);
}

tap(clearBtn, function() {
    _skipBlurCollapse = true;
    searchInput.value = '';
    setVisible(clearBtn, false); setVisible(suggestionsMenu, false);
    setSearchActive(false);
    resetMapKeepOpen();
    searchInput.focus();
});

function resetMapKeepOpen() {
    if (linhaClicada) { linhaClicada.setStyle(ESTILO_NORMAL); linhaClicada = null; }
    Object.keys(ruas).forEach(function(r) {
        ruas[r].setStyle(ESTILO_NORMAL);
        if (!minhasRuas.hasLayer(ruas[r])) minhasRuas.addLayer(ruas[r]);
    });
    if (ruasVisiveis) {
        minhasRuas.addTo(map);
    } else {
        map.removeLayer(minhasRuas);
    }
    map.closePopup();
}

function resetMap() {
    if (linhaClicada) { linhaClicada.setStyle(ESTILO_NORMAL); linhaClicada = null; }
    Object.keys(ruas).forEach(function(r) {
        ruas[r].setStyle(ESTILO_NORMAL);
        if (!minhasRuas.hasLayer(ruas[r])) minhasRuas.addLayer(ruas[r]);
    });
    if (ruasVisiveis) {
        minhasRuas.addTo(map);
    } else {
        map.removeLayer(minhasRuas);
    }
    map.closePopup();
    searchInput.value = '';
    setVisible(clearBtn, false); setVisible(suggestionsMenu, false);
    setSearchActive(false); searchContainer.classList.remove('expanded');
}

/* ─────────────────────────────────────────────────────
   13. Arranque
   ───────────────────────────────────────────────────── */
var kmls = [
    'kml/MarrancosArcozelo.kml',
    'kml/RibeiraDoNeiva.kml',
    'kml/Loureira.kml',
    'kml/Soutelo.kml'
];
Promise.all(kmls.map(carregarKML))
    .then(inicializarPesquisa)
    .catch(function(err) {
        console.error('Falha ao carregar KMLs:', err);
        inicializarPesquisa();
    });