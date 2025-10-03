// Variables globales
let table;
let filteredData = [...restrictionsData];
let map;
let currentFeature = null;
let geojsonLayers = {};

// Función para actualizar las opciones de un filtro específico
function updateFilterOptions(filterId, data, property) {
    const select = document.getElementById(filterId);
    const currentValue = select.value;

    // Obtener valores únicos y ordenar
    let values = [...new Set(data.map(item => item[property]))].sort();

    // Filtrar valores vacíos o nulos
    values = values.filter(value => value !== undefined && value !== null && value !== '');

    // Limpiar el select, pero dejando la opción "Todos"
    select.innerHTML = '<option value="">Todos</option>';

    // Agregar las nuevas opciones
    values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });

    // Restaurar el valor seleccionado si aún existe
    if (currentValue && values.includes(currentValue)) {
        select.value = currentValue;
    } else {
        select.value = '';
    }
}

// Función para actualizar todos los filtros basados en los datos filtrados
function updateAllFilters() {
    updateFilterOptions('countryFilter', filteredData, 'pais');
    updateFilterOptions('typeFilter', filteredData, 'tipo_descrip');
    updateFilterOptions('eudrFilter', filteredData, 'eudr_cat');
    updateFilterOptions('cuantifyFilter', filteredData, 'cuantificable');
    updateFilterOptions('datasetFilter', filteredData, 'tipo_dataset');
    updateFilterOptions('processFilter', filteredData, 'tipo_geoproceso');
    updateFilterOptions('scaleFilter', filteredData, 'nivel_escala');
}

$(document).ready(function () {
    initializeTable();
    populateFilters();
    setupEventListeners();
    updateStats();
    initializeMap();

    // Ocultar el indicador de carga del mapa después de un tiempo
    setTimeout(() => {
        $('#map-loading').fadeOut();
    }, 1500);
});

function initializeMap() {
    // Inicializar el mapa centrado en Sudamérica
    map = L.map('map').setView([-15.0, -60.0], 4);

    // Capa base (solo OpenStreetMap)
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    osmLayer.addTo(map);

    // Agregar leyenda
    addLegend();

    // Evento para cuando se hace clic en el mapa
    map.on('click', function () {
        $('#featureInfo').hide();
        if (currentFeature) {
            resetFeatureStyle(currentFeature);
            currentFeature = null;
        }
    });

    // Cargar las capas GeoJSON desde los datos
    loadGeoJsonLayers();
}

function loadGeoJsonLayers() {
    // Mostrar indicador de carga
    document.getElementById('loading-indicator').style.display = 'block';

    // Contadores para el progreso
    let totalLayers = restrictionsData.length;
    let loadedLayers = 0;
    let errorLayers = 0;

    // Actualizar el indicador de carga
    updateLoadingIndicator(loadedLayers, totalLayers, errorLayers);

    // Colores predefinidos para las capas
    const predefinedColors = {
        'layer000': '#4CAF50',
        'layer001': '#F44336',
        'layer002': '#2196F3',
        'layer003': '#00BCD4',
        'layer004': '#FF9800',
        'layer005': '#9C27B0',
        'layer006': '#795548'
    };

    // Función para generar un color aleatorio
    function getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    // Función para añadir una capa GeoJSON
    function addGeoJSONLayer(id, name, url, color = null) {
        // Si no se especifica color, usar uno predefinido o aleatorio
        if (!color) {
            color = predefinedColors[id] || getRandomColor();
        }

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error al cargar el GeoJSON: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                // Crear capa GeoJSON
                const layer = L.geoJSON(data, {
                    style: {
                        color: color,
                        weight: 2,
                        fillOpacity: 0.3
                    },
                    onEachFeature: function (feature, layer) {
                        // Añadir popup con propiedades
                        if (feature.properties) {
                            let popupContent = '<div class="popup-content">';

                            for (const key in feature.properties) {
                                popupContent += `<div><strong>${key}:</strong> ${feature.properties[key]}</div>`;
                            }

                            popupContent += '</div>';
                            layer.bindPopup(popupContent);
                        }

                        // Evento de clic en la capa
                        layer.on('click', function (e) {
                            // Buscar el registro correspondiente por id_layer
                            const restriction = restrictionsData.find(r => r.id_layer === id);
                            if (restriction) {
                                showFeatureInfo(restriction);
                            }

                            // Resaltar la capa
                            if (currentFeature) {
                                resetFeatureStyle(currentFeature);
                            }
                            currentFeature = layer;
                            highlightFeature(layer);
                        });
                    }
                });

                // Guardar la capa
                geojsonLayers[id] = {
                    layer: layer,
                    url: url,
                    color: color,
                    visible: false,
                    name: name
                };

                // Actualizar el contador
                loadedLayers++;
                updateLoadingIndicator(loadedLayers, totalLayers, errorLayers);

                // Actualizar la lista de capas
                updateLayersList();

                // Si todas las capas se han cargado, ocultar el indicador
                if (loadedLayers + errorLayers === totalLayers) {
                    setTimeout(() => {
                        document.getElementById('loading-indicator').style.display = 'none';
                        if (errorLayers === 0) {
                            showNotification('Todas las capas se han cargado correctamente');
                        } else {
                            showNotification(`Se cargaron ${loadedLayers} de ${totalLayers} capas. ${errorLayers} capa(s) no se pudieron cargar.`, true);
                        }
                    }, 1000);
                }
            })
            .catch(error => {
                console.error('Error:', error);

                // Actualizar el contador de errores
                errorLayers++;
                updateLoadingIndicator(loadedLayers, totalLayers, errorLayers);

                // Si todas las capas se han cargado (con o sin errores), ocultar el indicador
                if (loadedLayers + errorLayers === totalLayers) {
                    setTimeout(() => {
                        document.getElementById('loading-indicator').style.display = 'none';
                        if (errorLayers === 0) {
                            showNotification('Todas las capas se han cargado correctamente');
                        } else {
                            showNotification(`Se cargaron ${loadedLayers} de ${totalLayers} capas. ${errorLayers} capa(s) no se pudieron cargar.`, true);
                        }
                    }, 1000);
                }
            });
    }

    // Cargar cada capa desde los datos
    restrictionsData.forEach(restriction => {
        if (restriction.id_layer && restriction.url_geojson) {
            addGeoJSONLayer(
                restriction.id_layer,
                restriction.entregable,
                restriction.url_geojson
            );
        }
    });
}

function updateLoadingIndicator(loaded, total, errors) {
    const loadingProgress = document.getElementById('loading-progress');
    const loadingLayers = document.getElementById('loading-layers');
    const loadingError = document.getElementById('loading-error');

    if (loaded === 0) {
        loadingProgress.textContent = 'Iniciando carga de capas...';
        loadingLayers.textContent = '';
        loadingError.textContent = '';
    } else if (loaded < total) {
        loadingProgress.textContent = `Cargando capas... (${loaded}/${total})`;
        loadingLayers.textContent = `${total - loaded} capas restantes por cargar`;

        if (errors > 0) {
            loadingError.textContent = `${errors} error(es) de carga`;
        }
    } else {
        // Todas las capas se han cargado (con o sin errores)
        loadingProgress.textContent = `Carga completada (${loaded}/${total})`;
        loadingLayers.textContent = '';

        if (errors > 0) {
            loadingError.textContent = `${errors} error(es) de carga`;
        }
    }
}

function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    const icon = isError ? 'fas fa-exclamation-circle' : 'fas fa-check-circle';
    notification.innerHTML = `<i class="${icon}"></i> ${message}`;
    notification.className = isError ? 'notification error' : 'notification';
    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

function updateLayersList() {
    const layersList = document.getElementById('layers-list');
    layersList.innerHTML = '';

    if (Object.keys(geojsonLayers).length === 0) {
        layersList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-map-marked-alt"></i>
                        <p>No hay capas disponibles</p>
                    </div>
                `;
        return;
    }

    for (const id in geojsonLayers) {
        const layerInfo = geojsonLayers[id];
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';

        layerItem.innerHTML = `
                    <div>
                        <span class="layer-color" style="background-color: ${layerInfo.color}"></span>
                        <span class="layer-name">${layerInfo.name}</span>
                    </div>
                    <div class="layer-actions">
                        <button class="btn btn-sm ${layerInfo.visible ? 'btn-success' : 'btn-outline-secondary'} btn-layer toggle-layer" data-id="${id}" title="${layerInfo.visible ? 'Ocultar capa' : 'Mostrar capa'}">
                            <i class="fas ${layerInfo.visible ? 'fa-eye' : 'fa-eye-slash'}"></i>
                        </button>
                        <button class="btn btn-sm btn-danger btn-layer remove-layer" data-id="${id}" title="Eliminar capa">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;

        layersList.appendChild(layerItem);
    }

    // Añadir event listeners a los botones
    document.querySelectorAll('.toggle-layer').forEach(button => {
        button.addEventListener('click', function () {
            const id = this.getAttribute('data-id');
            toggleLayer(id);
        });
    });

    document.querySelectorAll('.remove-layer').forEach(button => {
        button.addEventListener('click', function () {
            const id = this.getAttribute('data-id');
            removeLayer(id);
        });
    });

    // Añadir funcionalidad de búsqueda
    document.getElementById('searchLayers').addEventListener('input', function (e) {
        const searchTerm = e.target.value.toLowerCase();
        const layerItems = document.querySelectorAll('.layer-item');

        layerItems.forEach(item => {
            const layerName = item.querySelector('.layer-name').textContent.toLowerCase();
            if (layerName.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

function toggleLayer(id) {
    if (geojsonLayers[id]) {
        const layerInfo = geojsonLayers[id];

        if (layerInfo.visible) {
            map.removeLayer(layerInfo.layer);
            layerInfo.visible = false;
        } else {
            map.addLayer(layerInfo.layer);
            layerInfo.visible = true;

            // Ajustar el mapa a los límites de la capa
            try {
                map.fitBounds(layerInfo.layer.getBounds(), {
                    padding: [20, 20]
                });
            } catch (e) {
                console.error("Error al ajustar los límites de la capa:", e);
            }
        }

        updateLayersList();
    }
}

function removeLayer(id) {
    if (geojsonLayers[id]) {
        const layerInfo = geojsonLayers[id];

        if (layerInfo.visible) {
            map.removeLayer(layerInfo.layer);
        }

        delete geojsonLayers[id];
        updateLayersList();

        showNotification(`Capa "${layerInfo.name}" eliminada`);
    }
}

function showFeatureInfo(restriction) {
    let content = `
                <strong>${restriction.descripcion_restriccion}</strong><br>
                <strong>País:</strong> ${restriction.pais}<br>
                <strong>Tipo:</strong> ${restriction.tipo_restriccion}<br>
                <strong>ID:</strong> ${restriction.ip_restriccion}<br>
                <button class="btn btn-sm btn-primary mt-2" onclick="viewOnMap('${restriction.pais}', '${restriction.tipo_restriccion}', '${restriction.id_layer}')">Ver en Mapa</button>
                <button class="btn btn-sm btn-outline-primary mt-2 ms-1" onclick="showDetailForId('${restriction.ip_restriccion}')">Ver Detalle</button>
            `;
    $('#featureContent').html(content);
    $('#featureInfo').show();
}

function showDetailForId(id) {
    const item = restrictionsData.find(row => row.ip_restriccion === id);
    if (item) {
        showDetailModal(item.ip_restriccion);
    }
}

function resetFeatureStyle(feature) {
    feature.setStyle({
        color: feature.options.color,
        weight: 2,
        fillOpacity: 0.3
    });
}

function highlightFeature(feature) {
    feature.setStyle({
        weight: 5,
        color: '#e74c3c',
        fillOpacity: 0.9
    });
}

function addLegend() {
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'legend');
        div.innerHTML = '<h4>Leyenda</h4>' +
            '<i style="background:#3498db"></i> Ambiental/Forestal<br>' +
            '<i style="background:#e74c3c"></i> Hídrica<br>' +
            '<i style="background:#27ae60"></i> Fauna<br>' +
            '<i style="background:#8e44ad"></i> Urbana<br>' +
            '<i style="background:#1abc9c"></i> Cultural<br>' +
            '<i style="background:#95a5a6"></i> Otros<br>';
        return div;
    };
    legend.addTo(map);
}

function initializeTable() {
    table = $('#restrictionsTable').DataTable({
        data: restrictionsData,
        columns: [
            //1 Pais
            {
                data: "pais",
                title: "País",
                render: function (data) {
                    return `<span class="fw-bold">${data}</span>`;
                }
            },
            //2 ID Restriccion
            {
                data: "ip_restriccion",
                title: "ID Restricción",
                render: function (data) {
                    return `<code class="bg-light">${data}</code>`;
                }
            },
            //3 Norma Aplicable
            {
                data: "normativa_aplicable",
                title: "Norma Aplicable",
                render: function (data, type, row) {
                    if (row.enlace_norma && row.enlace_norma !== "") {
                        return `<a href="${row.enlace_norma}" target="_blank" class="text-decoration-none text-primary">${data}</a>`;
                    }
                    return data;
                }
            },
            //4 Descripción Restricción
            {
                data: "descripcion_restriccion",
                title: "Restricción",
                render: function (data) {
                    return data.length > 100 ? data.substring(0, 100) + '...' : data;
                }
            },
            //5 Tipo Restricción
            {
                data: "tipo_restriccion",
                title: "Tipo",
                render: function (data) {
                    return data;
                }
            },
            //6 Categoria EUDR
            {
                data: "eudr_cat",
                title: " Categoría EUDR",
                render: function (data) {
                    // Si data existe y no está vacío, es pertinente
                    return data;
                }
            },
            //7 Nombre Dataset
            {
                data: "nombre_del_dataset",
                title: "Dataset",
                render: function (data, type, row) {
                    if (!data || data === "") return "<span class='text-muted'>No especificado</span>";
                    if (row.enlace_dataset && row.enlace_dataset !== "") {
                        return `<a href="${row.enlace_dataset}" target="_blank" class="text-decoration-none text-info">${data}</a>`;
                    }
                    return data;
                }
            },
            //8 Tipo Geoanalisis
            {
                data: "tipo_analisis",
                title: "Tipo Analisis",
                render: function (data) {
                    if (!data || data === "") return "<span class='text-muted'>No especificado</span>";
                    return data.length > 50 ? data.substring(0, 50) + '...' : data;
                }
            },
            {
                data: null,
                title: "Acciones",
                orderable: false,
                render: function (data, type, row) {
                    return `
                                <button class="btn btn-sm btn-outline-primary view-detail" data-id="${row.ip_restriccion}" title="Ver detalle">
                                    <i class="fas fa-info-circle"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-success export-row" data-id="${row.ip_restriccion}" title="Exportar">
                                    <i class="fas fa-download"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-info view-on-map" data-country="${row.pais}" data-type="${row.tipo_restriccion}" data-id_layer="${row.id_layer}" title="Ver en mapa">
                                    <i class="fas fa-map-marked-alt"></i>
                                </button>
                            `;
                }
            }
        ],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json'
        },
        pageLength: 10,
        lengthMenu: [5, 10, 25, 50],
        responsive: true,
        order: [[0, 'asc']],
        initComplete: function () {
            updateResultsCount();
        }
    });

    $('#restrictionsTable tbody').on('click', '.view-detail', function () {
        const id = $(this).data('id');
        showDetailModal(id);
    });

    $('#restrictionsTable tbody').on('click', '.export-row', function () {
        const id = $(this).data('id');
        exportRow(id);
    });

    $('#restrictionsTable tbody').on('click', '.view-on-map', function () {
        const country = $(this).data('country');
        const type = $(this).data('type');
        const id_layer = $(this).data('id_layer');
        $('#map-tab').tab('show');
        viewOnMap(country, type, id_layer);
    });
}

function populateFilters() {
    updateFilterOptions('countryFilter', restrictionsData, 'pais');
    updateFilterOptions('typeFilter', restrictionsData, 'tipo_descrip');
    updateFilterOptions('eudrFilter', restrictionsData, 'eudr_cat');
    updateFilterOptions('cuantifyFilter', restrictionsData, 'cuantificable');
    updateFilterOptions('datasetFilter', restrictionsData, 'tipo_dataset');
    updateFilterOptions('processFilter', restrictionsData, 'tipo_geoproceso');
    updateFilterOptions('scaleFilter', restrictionsData, 'nivel_escala');
}

function setupEventListeners() {
    $('#applyFilters').click(function () {
        applyFilters();
    });

    $('#resetFilters').click(function () {
        resetFilters();
    });

    $('#searchInput').on('keyup', function () {
        applyFilters();
    });

    $('#countryFilter, #typeFilter, #eudrFilter, #cuantifyFilter, #datasetFilter, #processFilter, #scaleFilter').on('change', function () {
        applyFilters();
    });

    // Evento para recargar capas
    document.getElementById('reload-btn').addEventListener('click', function () {
        // Limpiar capas existentes
        for (const id in geojsonLayers) {
            const layerInfo = geojsonLayers[id];
            if (layerInfo.visible) {
                map.removeLayer(layerInfo.layer);
            }
        }

        // Reiniciar objeto de capas
        geojsonLayers = {};

        // Actualizar la lista de capas
        updateLayersList();

        // Volver a cargar las capas
        loadGeoJsonLayers();
    });

    // Hacer las tarjetas de estadísticas clickeables
    $('#totalRestrictionsCard').click(function () {
        resetFilters();
        $('#table-tab').tab('show');
    });

    $('#highEudrCard').click(function () {
        resetFilters();
        $('#eudrFilter').val('true');
        $('#table-tab').tab('show');
        applyFilters();
    });

    $('#protectedAreasCard').click(function () {
        resetFilters();
        $('#typeFilter').val('ambiental');
        $('#table-tab').tab('show');
        applyFilters();
    });

    $('#waterBuffersCard').click(function () {
        resetFilters();
        $('#typeFilter').val('hidrica');
        $('#table-tab').tab('show');
        applyFilters();
    });
}

function applyFilters() {
    const countryFilter = $('#countryFilter').val();
    const typeFilter = $('#typeFilter').val();
    const eudrFilter = $('#eudrFilter').val();
    const cuantifyFilter = $('#cuantifyFilter').val();
    const datasetFilter = $('#datasetFilter').val();
    const processFilter = $('#processFilter').val();
    const scaleFilter = $('#scaleFilter').val();
    const searchFilter = $('#searchInput').val().toLowerCase();

    filteredData = restrictionsData.filter(item => {
        const countryMatch = !countryFilter || item.pais === countryFilter;
        const typeMatch = !typeFilter || item.tipo_descrip === typeFilter;
        const eudrMatch = !eudrFilter || item.eudr_cat === eudrFilter;
        const cuantifyMatch = !cuantifyFilter || item.cuantificable === cuantifyFilter;
        const datasetMatch = !datasetFilter || item.tipo_dataset === datasetFilter;
        const processMatch = !processFilter || item.tipo_geoproceso === processFilter;
        const scaleMatch = !scaleFilter || item.nivel_escala === scaleFilter;
        const searchMatch = !searchFilter ||
            item.pais.toLowerCase().includes(searchFilter) ||
            item.normativa_aplicable.toLowerCase().includes(searchFilter) ||
            item.descripcion_restriccion.toLowerCase().includes(searchFilter) ||
            item.ip_restriccion.toLowerCase().includes(searchFilter) ||
            item.tipo_restriccion.toLowerCase().includes(searchFilter) ||
            (item.nombre_del_dataset && item.nombre_del_dataset.toLowerCase().includes(searchFilter));

        return countryMatch && typeMatch && eudrMatch && cuantifyMatch && datasetMatch && processMatch && scaleMatch && searchMatch;
    });

    // Actualizar la tabla y estadísticas
    table.clear();
    table.rows.add(filteredData);
    table.draw();
    updateStats();
    updateResultsCount();
    updateActiveFilters();
    toggleNoResults();

    // Actualizar las opciones de los filtros (comportamiento anidado)
    updateAllFilters();
}

function resetFilters() {
    // Restablecer los valores de los filtros
    $('#countryFilter').val('');
    $('#typeFilter').val('');
    $('#eudrFilter').val('');
    $('#cuantifyFilter').val('');
    $('#datasetFilter').val('');
    $('#processFilter').val('');
    $('#scaleFilter').val('');
    $('#searchInput').val('');

    // Restablecer los datos
    filteredData = [...restrictionsData];

    // Actualizar la tabla y estadísticas
    table.clear();
    table.rows.add(filteredData);
    table.draw();
    updateStats();
    updateResultsCount();
    updateActiveFilters();
    toggleNoResults();

    // Actualizar las opciones de los filtros (con todos los datos)
    updateAllFilters();
}

function updateStats() {
    const total = filteredData.length;
    const eudr = filteredData.filter(item => item.eudr_cat).length;
    const environmental = filteredData.filter(item =>
        item.tipo_restriccion.includes('ambiental') ||
        item.tipo_restriccion.includes('forestal') ||
        item.tipo_restriccion.includes('Conservación')
    ).length;
    const water = filteredData.filter(item =>
        item.tipo_restriccion.includes('hidrica') ||
        item.tipo_restriccion.includes('Hídrica')
    ).length;

    $('#totalRestrictions').text(total);
    $('#highEudr').text(eudr);
    $('#protectedAreas').text(environmental);
    $('#waterBuffers').text(water);
}

function updateResultsCount() {
    $('#resultsCount').text(`${filteredData.length} resultados`);
}

function updateActiveFilters() {
    const countryFilter = $('#countryFilter').val();
    const typeFilter = $('#typeFilter').val();
    const eudrFilter = $('#eudrFilter').val();
    const cuantifyFilter = $('#cuantifyFilter').val();
    const datasetFilter = $('#datasetFilter').val();
    const processFilter = $('#processFilter').val();
    const scaleFilter = $('#scaleFilter').val();
    const searchFilter = $('#searchInput').val();

    let badgesHtml = '';
    let hasActiveFilters = false;

    if (countryFilter) {
        badgesHtml += `<span class="filter-badge"><i class="fas fa-globe-americas"></i> ${countryFilter}</span>`;
        hasActiveFilters = true;
    }

    if (typeFilter) {
        badgesHtml += `<span class="filter-badge"><i class="fas fa-layer-group"></i> ${typeFilter}</span>`;
        hasActiveFilters = true;
    }

    if (eudrFilter) {
        badgesHtml += `<span class="filter-badge"><i class="fas fa-leaf"></i> EUDR ${eudrFilter === "true" ? "Sí" : "No"}</span>`;
        hasActiveFilters = true;
    }

    if (cuantifyFilter) {
        badgesHtml += `<span class="filter-badge"><i class="fas fa-check-circle"></i> Cuantificable ${cuantifyFilter}</span>`;
        hasActiveFilters = true;
    }

    if (datasetFilter) {
        badgesHtml += `<span class="filter-badge"><i class="fas fa-database"></i> ${datasetFilter}</span>`;
        hasActiveFilters = true;
    }

    if (processFilter) {
        badgesHtml += `<span class="filter-badge"><i class="fas fa-cogs"></i> ${processFilter}</span>`;
        hasActiveFilters = true;
    }

    if (scaleFilter) {
        badgesHtml += `<span class="filter-badge"><i class="fas fa-ruler"></i> ${scaleFilter}</span>`;
        hasActiveFilters = true;
    }

    if (searchFilter) {
        badgesHtml += `<span class="filter-badge"><i class="fas fa-search"></i> "${searchFilter}"</span>`;
        hasActiveFilters = true;
    }

    $('#filterBadges').html(badgesHtml);
    $('#activeFilters').toggle(hasActiveFilters);

    $('.filter-badge').on('click', function () {
        const badgeText = $(this).text().trim();

        if (badgeText.includes('EUDR')) {
            $('#eudrFilter').val('');
        } else if (badgeText.includes('ambiental') || badgeText.includes('forestal') || badgeText.includes('Conservación') || badgeText.includes('hidrica') || badgeText.includes('Hídrica')) {
            $('#typeFilter').val('');
        } else if (badgeText.includes('Cuantificable')) {
            $('#cuantifyFilter').val('');
        } else if (badgeText.includes('Dataset')) {
            $('#datasetFilter').val('');
        } else if (badgeText.includes('Proceso')) {
            $('#processFilter').val('');
        } else if (badgeText.includes('Escala')) {
            $('#scaleFilter').val('');
        } else if (badgeText.startsWith('"')) {
            $('#searchInput').val('');
        } else {
            $('#countryFilter').val('');
        }

        applyFilters();
    });
}

function toggleNoResults() {
    const hasResults = filteredData.length > 0;
    $('#noResults').toggle(!hasResults);
    $('.table-responsive').toggle(hasResults);
}

function showDetailModal(id) {
    const item = restrictionsData.find(row => row.ip_restriccion === id);
    if (item) {
        let modalContent = `
                    <div class="row">
                        <div class="col-md-6">
                            <h5><i class="fas fa-balance-scale"></i> Información Legal</h5>
                            <hr>
                            <p><strong><i class="fas fa-flag"></i> País:</strong> ${item.pais}</p>
                            <p><strong><i class="fas fa-id-card"></i> ID Restricción:</strong> <code>${item.ip_restriccion}</code></p>
                            <p><strong><i class="fas fa-book"></i> Normativa:</strong> <a href="${item.enlace_norma}" target="_blank" class="text-decoration-none">${item.normativa_aplicable}</a></p>
                            <p><strong><i class="fas fa-file-alt"></i> Artículo:</strong> ${item.articulo_norma}</p>
                            <p><strong><i class="fas fa-calendar-alt"></i> Fecha Norma:</strong> ${item.fecha_norma}</p>
                            <p><strong><i class="fas fa-building"></i> Institución Responsable:</strong> ${item.institucion_responsable}</p>
                            <p><strong><i class="fas fa-map-marker-alt"></i> Nivel/Escala:</strong> ${item.nivel_escala}</p>
                        </div>
                        <div class="col-md-6">
                            <h5><i class="fas fa-tools"></i> Detalles Técnicos</h5>
                            <hr>
                            <p><strong><i class="fas fa-layer-group"></i> Tipo de Restricción:</strong> <span class="badge ${getBadgeClass(item.tipo_restriccion)}">${item.tipo_restriccion}</span></p>
                            <p><strong><i class="fas fa-check-circle"></i> Cuantificable:</strong> ${item.cuantificable === 'Si' ? 'Sí' : 'No'}</p>
                            <p><strong><i class="fas fa-ruler"></i> Parámetros Geográficos:</strong> ${item.parametros_geo}</p>
                            <p><strong><i class="fas fa-draw-polygon"></i> Representación:</strong> ${item.representacion}</p>
                            <p><strong><i class="fas fa-chart-line"></i> Tipo de Análisis:</strong> ${item.tipo_analisis || "No especificado"}</p>
                        </div>
                    </div>
                    <div class="row mt-4">
                        <div class="col-12">
                            <h5><i class="fas fa-align-left"></i> Descripción de la Restricción</h5>
                            <hr>
                            <div class="alert alert-info">${item.descripcion_restriccion}</div>
                        </div>
                    </div>
                    <div class="row mt-4">
                        <div class="col-12">
                            <h5><i class="fas fa-leaf"></i> Pertinencia EUDR</h5>
                            <hr>
                            <div class="alert alert-${item.eudr_cat ? 'success' : 'secondary'}">
                                ${item.eudr_cat ? `Categoría: ${item.eudr_cat}. ${item.pertinencia_eudr}` : 'Esta restricción no es pertinente para el cumplimiento del EUDR'}
                            </div>
                        </div>
                    </div>
                    <div class="row mt-4">
                        <div class="col-12">
                            <h5><i class="fas fa-database"></i> Dataset y Geoproceso</h5>
                            <hr>
                            <p><strong><i class="fas fa-layer-group"></i> Nombre de la Capa:</strong> ${item.nombre_del_dataset || "<span class='text-muted'>No especificado</span>"}</p>
                            <p><strong><i class="fas fa-calendar-day"></i> Fecha del Dataset:</strong> ${item.fecha_dataset ? excelDateToJSDate(item.fecha_dataset).toLocaleDateString() : "<span class='text-muted'>No especificado</span>"}</p>
                            <p><strong><i class="fas fa-info-circle"></i> Descripción del Dataset:</strong> ${item.descripcion_dataset || "<span class='text-muted'>No especificado</span>"}</p>
                            <p><strong><i class="fas fa-building"></i> Proveedor del Dataset:</strong> ${item.proveedor_dataset || "<span class='text-muted'>No especificado</span>"}</p>
                            <p><strong><i class="fas fa-globe-americas"></i> Cobertura espacial:</strong> ${item.cobertura_espacial || "<span class='text-muted'>No especificado</span>"}</p>
                            <p><strong><i class="fas fa-link"></i> Fuente:</strong> ${item.fuente || "<span class='text-muted'>No especificado</span>"}</p>
                            <p><strong><i class="fas fa-file-contract"></i> Licencia/Condiciones de uso:</strong> ${item.licencia_condiciones_de_uso || "<span class='text-muted'>No especificado</span>"}</p>
                            <p><strong><i class="fas fa-external-link-alt"></i> Enlace al Dataset:</strong> ${item.enlace_dataset ? `<a href="${item.enlace_dataset}" target="_blank" class="text-decoration-none">${item.enlace_dataset}</a>` : "<span class='text-muted'>No especificado</span>"}</p>
                            <p><strong><i class="fas fa-comment"></i> Observaciones:</strong> ${item.observaciones_relevantes || "<span class='text-muted'>No hay observaciones</span>"}</p>
                        </div>
                    </div>
                    <div class="row mt-4">
                        <div class="col-12">
                            <h5><i class="fas fa-cogs"></i> Geoproceso a Realizar</h5>
                            <hr>
                            <div class="bg-light p-3 rounded">
                                ${item.geoproceso_a_realizar || "<span class='text-muted'>No especificado</span>"}
                            </div>
                        </div>
                    </div>
                    <div class="row mt-4">
                        <div class="col-12">
                            <h5><i class="fas fa-info"></i> Información Adicional</h5>
                            <hr>
                            <p><strong><i class="fas fa-tag"></i> Categoría EUDR:</strong> ${item.eudr_cat || "<span class='text-muted'>No especificado</span>"}</p>
                            <p><strong><i class="fas fa-file"></i> Tipo de Descripción:</strong> ${item.tipo_descrip || "<span class='text-muted'>No especificado</span>"}</p>
                            <p><strong><i class="fas fa-map"></i> Cartografía Base:</strong> ${item.cartografia_base || "<span class='text-muted'>No especificado</span>"}</p>
                            <p><strong><i class="fas fa-cog"></i> Tipo de Geoproceso:</strong> ${item.tipo_geoproceso || "<span class='text-muted'>No especificado</span>"}</p>
                            <p><strong><i class="fas fa-file-export"></i> Entregable:</strong> ${item.entregable || "<span class='text-muted'>No especificado</span>"}</p>
                            <p><strong><i class="fas fa-link"></i> Link Entregable:</strong> ${item.link_entregable ? `<a href="${item.link_entregable}" target="_blank" class="text-decoration-none">${item.link_entregable}</a>` : "<span class='text-muted'>No especificado</span>"}</p>
                        </div>
                    </div>
                    <div class="row mt-4">
                        <div class="col-12">
                            <button class="btn btn-primary" onclick="viewOnMap('${item.pais}', '${item.tipo_restriccion}', '${item.id_layer}')">
                                <i class="fas fa-map-marked-alt"></i> Ver esta restricción en el mapa
                            </button>
                        </div>
                    </div>
                `;

        $('#modalContent').html(modalContent);
        $('#detailModalLabel').text(`Detalle de la Restricción: ${item.ip_restriccion}`);
        new bootstrap.Modal(document.getElementById('detailModal')).show();
    }
}

function viewOnMap(country, type, id_layer) {
    // Verificar si el modal está abierto antes de intentar ocultarlo
    const detailModal = document.getElementById('detailModal');
    const modalInstance = bootstrap.Modal.getInstance(detailModal);
    if (modalInstance) {
        modalInstance.hide();
    }

    $('#map-tab').tab('show');

    // Activar la capa correspondiente si existe
    if (id_layer && geojsonLayers[id_layer]) {
        const layerInfo = geojsonLayers[id_layer];
        if (!layerInfo.visible) {
            map.addLayer(layerInfo.layer);
            layerInfo.visible = true;
            updateLayersList();
        }

        // Ajustar el mapa a los límites de la capa
        try {
            map.fitBounds(layerInfo.layer.getBounds(), {
                padding: [20, 20] // Añadir padding para mejor visualización
            });
        } catch (e) {
            console.error("Error al ajustar los límites de la capa:", e);
            // Si falla, centrar en el país
            centerMapOnCountry(country);
        }
    } else {
        // Si no hay capa, centrar en el país
        centerMapOnCountry(country);
    }
}

function centerMapOnCountry(country) {
    let center;
    let zoom = 6; // Zoom por defecto

    // Coordenadas centrales para cada país
    const countryCenters = {
        "Belice": { center: [17.0, -88.0], zoom: 8 },
        "Chile": { center: [-35.0, -71.0], zoom: 5 },
        "Perú": { center: [-13.0, -74.0], zoom: 6 },
        "Colombia": { center: [4.0, -73.0], zoom: 6 },
        "Brasil": { center: [-10.0, -55.0], zoom: 5 },
        "México": { center: [19.0, -99.0], zoom: 5 },
        "Argentina": { center: [-40.0, -72.0], zoom: 5 },
        "Ecuador": { center: [-2.0, -44.0], zoom: 7 },
        "Bolivia": { center: [-17.0, -65.0], zoom: 6 },
        "Venezuela": { center: [8.0, -66.0], zoom: 6 },
        "Paraguay": { center: [-23.0, -58.0], zoom: 7 },
        "Uruguay": { center: [-33.0, -56.0], zoom: 8 },
        "Guyana": { center: [5.0, -58.0], zoom: 7 },
        "Surinam": { center: [4.0, -56.0], zoom: 7 },
        "Guayana Francesa": { center: [4.0, -53.0], zoom: 8 }
    };

    if (countryCenters[country]) {
        center = countryCenters[country].center;
        zoom = countryCenters[country].zoom;
    } else {
        console.warn(`No se ha definido un centro para el país: ${country}`);
        // Coordenadas por defecto para Sudamérica
        center = [-15.0, -60.0];
        zoom = 4;
    }

    if (center) {
        map.setView(center, zoom);
    }
}

function getBadgeClass(type) {
    if (type.includes('ambiental') || type.includes('forestal') || type.includes('Conservación')) {
        return 'bg-primary';
    } else if (type.includes('hidrica') || type.includes('Hídrica')) {
        return 'bg-danger';
    } else if (type.includes('fauna')) {
        return 'bg-success';
    } else {
        return 'bg-secondary';
    }
}

function exportRow(id) {
    const item = restrictionsData.find(row => row.ip_restriccion === id);
    if (item) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text(`Detalle de Restricción: ${item.ip_restriccion}`, 14, 22);

        doc.setFontSize(12);
        doc.text(`País: ${item.pais}`, 14, 35);
        doc.text(`Normativa: ${item.normativa_aplicable}`, 14, 42);
        doc.text(`Tipo: ${item.tipo_restriccion}`, 14, 49);

        doc.setFontSize(11);
        doc.text("Descripción:", 14, 60);
        doc.setFontSize(10);
        const splitDescription = doc.splitTextToSize(item.descripcion_restriccion, 180);
        doc.text(splitDescription, 14, 65);

        let currentY = 65 + (splitDescription.length * 5) + 10;

        doc.setFontSize(11);
        doc.text("Pertinencia EUDR:", 14, currentY);
        doc.setFontSize(10);
        const splitEudr = doc.splitTextToSize(item.eudr_cat ? `Categoría: ${item.eudr_cat}. ${item.pertinencia_eudr}` : 'Esta restricción no es pertinente para el cumplimiento del EUDR', 180);
        doc.text(splitEudr, 14, currentY + 5);

        currentY = currentY + (splitEudr.length * 5) + 15;

        doc.setFontSize(11);
        doc.text("Dataset:", 14, currentY);
        doc.setFontSize(10);
        doc.text(`Nombre: ${item.nombre_del_dataset || "No especificado"}`, 14, currentY + 5);
        doc.text(`Proveedor: ${item.proveedor_dataset || "No especificado"}`, 14, currentY + 10);

        currentY = currentY + 25;

        doc.setFontSize(11);
        doc.text("Geoproceso a Realizar:", 14, currentY);
        doc.setFontSize(10);
        const splitGeoproceso = doc.splitTextToSize(item.geoproceso_a_realizar || "No especificado", 180);
        doc.text(splitGeoproceso, 14, currentY + 5);

        doc.save(`restriccion_${item.ip_restriccion}.pdf`);
    }
}

// Función para convertir fecha de Excel a JavaScript
function excelDateToJSDate(excelDate) {
    // Excel date is days since 1900-01-01, with 1900 being a leap year (incorrectly)
    // JavaScript date is milliseconds since 1970-01-01
    const jsDate = new Date((excelDate - 25569) * 86400 * 1000);
    return jsDate;
}

$('#exportExcel').click(function () {
    const wb = XLSX.utils.book_new();
    const ws_data = [
        ["País", "ID Restricción", "Normativa", "Descripción", "Tipo", "Pertinencia EUDR", "Dataset", "Geoproceso"]
    ];

    filteredData.forEach(row => {
        ws_data.push([
            row.pais,
            row.ip_restriccion,
            row.normativa_aplicable,
            row.descripcion_restriccion,
            row.tipo_restriccion,
            row.eudr_cat,
            row.nombre_del_dataset || "No especificado",
            row.geoproceso_a_realizar || "No especificado"
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, "Restricciones");
    XLSX.writeFile(wb, "restricciones_eudr.xlsx");
});

$('#exportExcelAll').click(function () {
    if (!filteredData || filteredData.length === 0) {
        alert("No hay datos para exportar");
        return;
    }

    const wb = XLSX.utils.book_new();

    // 1. Obtener todas las propiedades únicas de los objetos
    const headers = Object.keys(filteredData[0]);

    // 2. Crear ws_data con encabezados
    const ws_data = [headers];

    // 3. Agregar cada fila con sus valores
    restrictionsData.forEach(row => {
        const rowData = headers.map(h => row[h] ?? "No especificado");
        ws_data.push(rowData);
    });

    // 4. Generar la hoja y guardar
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, "Restricciones");
    XLSX.writeFile(wb, "restricciones_todo.xlsx");
});


$('#exportPDF').click(function () {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Reporte de Restricciones Legales - EUDR", 14, 22);
    doc.setFontSize(11);
    doc.text(`Generado el: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = [];
    filteredData.forEach(row => {
        tableData.push([
            row.pais,
            row.ip_restriccion,
            row.normativa_aplicable.substring(0, 30) + (row.normativa_aplicable.length > 30 ? "..." : ""),
            row.descripcion_restriccion.substring(0, 50) + (row.descripcion_restriccion.length > 50 ? "..." : ""),
            row.tipo_restriccion,
            row.eudr_cat ? "Sí" : "No"
        ]);
    });

    doc.autoTable({
        head: [['País', 'ID Restricción', 'Normativa', 'Descripción', 'Tipo', 'Pertinencia EUDR']],
        body: tableData,
        startY: 40,
        theme: 'grid',
        headStyles: { fillColor: [40, 100, 200] }
    });

    doc.save('restricciones_eudr.pdf');
});

// Función para mostrar/ocultar el panel de capas
document.addEventListener('DOMContentLoaded', function () {
    const toggleLayersPanel = document.getElementById('toggleLayersPanel');
    const layersPanel = document.getElementById('layersPanel');
    const toggleIcon = toggleLayersPanel.querySelector('i');

    toggleLayersPanel.addEventListener('click', function () {
        layersPanel.classList.toggle('show');

        // Cambiar el ícono del botón según el estado del panel
        if (layersPanel.classList.contains('show')) {
            toggleIcon.classList.remove('fa-layer-group');
            toggleIcon.classList.add('fa-times');
        } else {
            toggleIcon.classList.remove('fa-times');
            toggleIcon.classList.add('fa-layer-group');
        }
    });

    // El resto del código JavaScript existente...
});
