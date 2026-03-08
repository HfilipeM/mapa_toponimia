// 1. Definição das camadas individuais
var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 22,
    attribution: '© OpenStreetMap'
});

var sat_base = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 22,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});

var sat_labels = L.tileLayer('https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
    maxZoom: 22,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});

var googleSatCompleto = L.layerGroup([sat_base, sat_labels]);

// 2. Inicialização do Mapa
var map = L.map('map', {
    zoomControl: false,
    fadeAnimation: false,
    center: [41.66, -8.47],
    zoom: 12.5,
    layers: [googleSatCompleto]
});

// Fechar popup quando clica no mapa (fora de qualquer rua)
map.on('click', function() {
    if (linhaClicada) {
        linhaClicada.setStyle({ color: "blue", weight: 8, opacity: 0.6 });
        linhaClicada = null;
    }
    map.closePopup();
});

var minhasRuas = L.layerGroup().addTo(map);
var ruas = {};
var linhaClicada = null; // Guarda a linha que foi clicada

// 3. Controlo de Camadas
var baseMaps = {
    "Predefenição": osm,
    "Satélite": googleSatCompleto
};
L.control.layers(baseMaps, { "Toponímias": minhasRuas }).addTo(map);

// Elementos da Pesquisa
const searchContainer = document.querySelector(".search-container");
const searchButton = document.getElementById("search-button");
const searchInput = document.getElementById("search");
const clearBtn = document.getElementById("clear-search");
const suggestionsMenu = document.getElementById("suggestions");

// Popup único para o mapa todo
var popupFlutuante = L.popup({ 
    closeButton: false, 
    className: 'popup-container', 
    offset: [0, -10],
    autoPan: false // Desativa movimento automático do mapa
});

// Expandir searchbox ao clicar na lupa
searchButton.addEventListener("click", function() {
    searchContainer.classList.add("expanded");
    searchInput.focus();
});

// Colapsar searchbox quando perde o foco (se estiver vazia)
searchInput.addEventListener("blur", function() {
    setTimeout(() => {
        if (searchInput.value === "" && !suggestionsMenu.querySelector(".suggestion-item:hover")) {
            searchContainer.classList.remove("expanded");
            suggestionsMenu.style.display = "none";
        }
    }, 200);
});

// 4. Função para criar conteúdo do popup
function criarConteudoPopup(nome, pontosArray) {
    let container = document.createElement("div");
    container.innerHTML = `<b>${nome}</b><br>`;

    let btn = document.createElement("button");
    btn.innerText = "Copiar coordenadas";
    btn.className = "btn-copiar";

    btn.onclick = function (event) {
        event.stopPropagation(); // Evita fechar o popup ao clicar no botão
        
        let indiceMeio = Math.floor(pontosArray.length / 2);
        let p = pontosArray[indiceMeio].split(",");
        let coord = p[1] + "," + p[0];
        
        // Usa navigator.clipboard de forma mais robusta
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(coord).then(() => {
                mostrarToast("Copiado!");
            }).catch(err => {
                console.error("Erro ao copiar:", err);
                // Fallback: copia manualmente
                copiarManualmente(coord);
            });
        } else {
            // Fallback para browsers mais antigos
            copiarManualmente(coord);
        }
    };

    container.appendChild(btn);
    return container;
}

// Função fallback para copiar sem clipboard API
function copiarManualmente(texto) {
    const textarea = document.createElement("textarea");
    textarea.value = texto;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand("copy");
        mostrarToast("Copiado!");
    } catch (err) {
        console.error("Erro ao copiar:", err);
        mostrarToast("Erro ao copiar");
    }
    document.body.removeChild(textarea);
}

// 5. Função para carregar KML
function carregarKML(url) {
    return fetch(url)
        .then(response => response.text())
        .then(data => {
            let parser = new DOMParser();
            let xml = parser.parseFromString(data, "text/xml");
            let placemarks = xml.getElementsByTagName("Placemark");

            for (let p of placemarks) {
                let nome = p.getElementsByTagName("name")[0].textContent;
                let coordsRaw = p.getElementsByTagName("coordinates")[0].textContent.trim();
                let pontosArray = coordsRaw.split(/\s+/);

                let coordsParaMapa = pontosArray.map(ponto => {
                    let c = ponto.split(",");
                    return [parseFloat(c[1]), parseFloat(c[0])];
                });

                // Estilo das linhas
                let line = L.polyline(coordsParaMapa, { color: "blue", weight: 8, opacity: 0.6 }).addTo(minhasRuas);

                // Guarda os pontos no próprio objeto line para evitar problemas de closure
                line.pontosArray = pontosArray;
                line.nomeRua = nome;

                // EVENTO MOUSEOVER - Mostra popup temporário
                line.on("mouseover", function (e) {
                    // Se havia uma linha clicada e não é esta, reseta a anterior
                    if (linhaClicada && linhaClicada !== this) {
                        linhaClicada.setStyle({ color: "blue", weight: 8, opacity: 0.6 });
                        linhaClicada = null;
                    }
                    
                    // Aplica o estilo amarelo e mostra popup
                    this.setStyle({ color: "yellow", weight: 8, opacity: 0.6 });
                    
                    let container = criarConteudoPopup(this.nomeRua, this.pontosArray);
                    popupFlutuante.setLatLng(e.latlng).setContent(container).openOn(map);
                });

                // EVENTO MOUSEOUT - Remove popup temporário
                line.on("mouseout", function (e) {
                    // Só volta ao estilo normal se não for a linha clicada
                    if (this !== linhaClicada) {
                        this.setStyle({ color: "blue", weight: 8, opacity: 0.6 });
                        map.closePopup();
                    }
                });

                // EVENTO CLICK - Fixa o popup
                line.on("click", function (e) {
                    L.DomEvent.stopPropagation(e); // Evita que o click propague para o mapa
                    
                    // Se havia outra linha clicada, volta ao normal
                    if (linhaClicada && linhaClicada !== this) {
                        linhaClicada.setStyle({ color: "blue", weight: 8, opacity: 0.6 });
                    }
                    
                    // Define esta como a linha clicada
                    linhaClicada = this;
                    this.setStyle({ color: "yellow", weight: 8, opacity: 0.6 });
                    
                    // Mostra o popup fixo
                    let container = criarConteudoPopup(this.nomeRua, this.pontosArray);
                    popupFlutuante.setLatLng(e.latlng).setContent(container).openOn(map);
                });

                ruas[nome] = line;
            }
        })
        .catch(err => console.error("Erro ao ler KML:", err));
}

// Toast
function mostrarToast(mensagem) {
    let toast = document.getElementById("toast-copiado");
    toast.innerText = mensagem;
    toast.style.display = "block";

    setTimeout(() => {
        toast.style.display = "none";
    }, 2000);
}

// 6. Pesquisa com Fuse.js (fuzzy matching)
var fuse = null;

function inicializarPesquisa() {
    const options = {
        keys: ['name'],
        threshold: 0.4, // Equilíbrio entre precisão e flexibilidade
        distance: 100,
        ignoreLocation: true,
        useExtendedSearch: false,
        includeScore: true,
        minMatchCharLength: 2, // Aceita a partir de 2 caracteres
        shouldSort: true // Ordena por relevância
    };
    
    const ruasArray = Object.keys(ruas).map(nome => ({ name: nome }));
    fuse = new Fuse(ruasArray, options);
}

// Função para normalizar texto (remove acentos e pontuação)
function normalizar(texto) {
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ") // Substitui pontuação por espaço
        .replace(/\s+/g, " ") // Normaliza espaços
        .trim();
}

searchInput.addEventListener("input", function () {
    let textoOriginal = this.value;
    let texto = normalizar(textoOriginal);
    suggestionsMenu.innerHTML = "";
    
    if (textoOriginal === "") {
        clearBtn.style.display = "none";
        suggestionsMenu.style.display = "none";
        resetMap();
        return;
    }
    
    clearBtn.style.display = "block";
    
    // Se Fuse ainda não foi inicializado, aguarda
    if (!fuse) {
        return;
    }
    
    // Pesquisa fuzzy
    const allResults = fuse.search(texto);
    
    // Filtrar resultados por score de forma mais permissiva
    // Para pesquisas curtas (< 5 chars), ser mais permissivo
    const maxScore = texto.length < 5 ? 0.5 : 0.4;
    const goodResults = allResults.filter(r => r.score < maxScore);
    
    // Limitar a 4 melhores resultados
    let results = goodResults.slice(0, 4);
    
    if (results.length > 0) {
        suggestionsMenu.style.display = "block";
        results.forEach(result => {
            let nome = result.item.name;
            let div = document.createElement("div");
            div.className = "suggestion-item";
            div.innerText = nome;
            div.onclick = function () { selecionarRua(nome); };
            suggestionsMenu.appendChild(div);
        });
    } else {
        suggestionsMenu.style.display = "none";
    }
});

function selecionarRua(nome) {
    searchInput.value = nome;
    suggestionsMenu.style.display = "none";
    
    // Fecha qualquer popup aberto
    map.closePopup();
    
    // Limpa a linha clicada anterior
    if (linhaClicada) {
        linhaClicada.setStyle({ color: "blue", weight: 8, opacity: 0.6 });
        linhaClicada = null;
    }
    
    Object.keys(ruas).forEach(r => {
        if (r === nome) {
            if (!map.hasLayer(ruas[r])) ruas[r].addTo(map);
            ruas[r].setStyle({ color: "blue", weight: 10, opacity: 0.6 });
            
            // Move o mapa para mostrar a rua selecionada
            map.fitBounds(ruas[r].getBounds(), {
                padding: [50, 50],
                maxZoom: 16
            });
        } else {
            map.removeLayer(ruas[r]);
        }
    });
    
    // Colapsa e limpa a searchbox após seleção
    setTimeout(() => {
        searchInput.value = "";
        searchInput.blur();
        clearBtn.style.display = "none";
        searchContainer.classList.remove("expanded");
    }, 300); // Pequeno delay para suavizar a transição
}

clearBtn.onclick = function () {
    searchInput.value = "";
    this.style.display = "none";
    suggestionsMenu.style.display = "none";
    searchContainer.classList.remove("expanded");
    resetMap();
};

function resetMap() {
    // Limpa a linha clicada
    if (linhaClicada) {
        linhaClicada.setStyle({ color: "blue", weight: 8, opacity: 0.6 });
        linhaClicada = null;
    }
    
    Object.keys(ruas).forEach(nome => {
        if (!map.hasLayer(ruas[nome])) ruas[nome].addTo(map);
        ruas[nome].setStyle({ color: "blue", weight: 8, opacity: 0.6 });
    });
    
    map.closePopup();
}

// 7. Chamadas
const kmls = [
    'kml/MarrancosArcozelo.kml',
    'kml/RibeiraDoNeiva.kml',
    'kml/Loureira.kml',
    'kml/Soutelo.kml'
];

let kmlsCarregados = 0;

kmls.forEach(kml => {
    carregarKML(kml).then(() => {
        kmlsCarregados++;
        if (kmlsCarregados === kmls.length) {
            // Todos os KMLs foram carregados, inicializa a pesquisa
            inicializarPesquisa();
        }
    });
});