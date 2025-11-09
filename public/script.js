    // --- CONFIGURATION ---
    const API_BASE_URL = '/api'; // Utilise un chemin relatif pour que le frontend appelle le backend qui le sert.
    const GUILD_ID = '355051708503687168'; // Remplacez par un ID de serveur pour les tests

    // Fonction pour vérifier si le token est présent et valide
    function getAuthToken() {
        const token = localStorage.getItem('token');
        console.log('Token dans le localStorage:', token ? 'Présent' : 'Absent');
        return token;
    }

    // Fonction pour faire des requêtes authentifiées
    async function makeFetchRequest(url, options = {}) {
        const token = getAuthToken();
        if (!token) {
            console.log('Pas de token trouvé, redirection vers login');
            window.location.href = '/login.html';
            return null;
        }

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        try {
            console.log('Envoi requête authentifiée à:', url);
            const response = await fetch(url, { ...options, headers });
            
            if (response.status === 401) {
                console.log('Token invalide ou expiré');
                localStorage.removeItem('token');
                window.location.href = '/login.html';
                return null;
            }
            return response;
        } catch (error) {
            console.error('Erreur réseau:', error);
            throw error;
        }
    }

    // Vérification de l'authentification au chargement de la page
    async function checkAuthentication() {
        console.log('Vérification de l\'authentification...');
        const token = getAuthToken();
        const currentPath = window.location.pathname;
        
        if (currentPath === '/login.html') {
            console.log('Page de login, pas de vérification nécessaire');
            return;
        }

        if (!token) {
            console.log('Pas de token, redirection vers login');
            window.location.href = '/login.html';
            return;
        }

        try {
            console.log('Test de validité du token...');
            // Use guilds activity endpoint as a health check
            const response = await makeFetchRequest(`${API_BASE_URL}/dashboard/guilds/${GUILD_ID}/activity`);
            if (!response || !response.ok) {
                throw new Error('Token invalide');
            }
            console.log('Token valide, accès autorisé');
        } catch (error) {
            console.error('Erreur d\'authentification:', error);
            localStorage.removeItem('token');
            window.location.href = '/login.html';
        }
    }

    // Vérifie l'authentification au chargement
    window.addEventListener('load', checkAuthentication);
        // Thème (light/dark) toggle simple
        document.addEventListener('DOMContentLoaded', () => {
            const toggle = document.getElementById('themeToggle');
            if (toggle) {
                const root = document.documentElement;
                const saved = localStorage.getItem('dashboard-theme');
                if (saved === 'dark') root.classList.add('theme-dark');
                toggle.addEventListener('click', () => {
                    root.classList.toggle('theme-dark');
                    const active = root.classList.contains('theme-dark') ? 'dark' : 'light';
                    localStorage.setItem('dashboard-theme', active);
                    const icon = toggle.querySelector('i');
                    if (icon) {
                        icon.classList.toggle('fa-moon', active === 'light');
                        icon.classList.toggle('fa-sun', active === 'dark');
                    }
                });
            }
        });
        
    // Configuration personnalisée pour l'ordre et les couleurs des canaux
        const CHANNEL_ORDER = [
            '355052157709320193', '959744073634304020', '1356734541787697314', '1224975207396151316',
            '797014090488872989', '1399789953700991047', '893642766184247296', '1358552538160562497',
            '1356332046066122794', '845046675382730773'
        ];
        const CHANNEL_COLORS = {
            '355052157709320193': '#ececec',      // AFK
            '959744073634304020': '#ff3636ff',      // Salon rouge
            '1356734541787697314': '#0078d7',     // Salon bleu
            '1224975207396151316': '#b08158',     // Café Alain
            '797014090488872989': '#16c60c',      // Travail
            '1399789953700991047': '#87b119',     // Cozy Café
            '893642766184247296': '#383838',     // Cinéma
            '1358552538160562497': '#886ce4',     // Café du fond
            '1356332046066122794': '#f4ca5d',     // Frit'bunal
            '845046675382730773': '#ffc83d'       // Conseil
        };

        let rawApiData = []; // Pour stocker les données brutes de l'API
        let allChannels = []; // Pour stocker la liste de tous les canaux uniques
        let selectedUserIds = []; // Pour stocker les IDs des utilisateurs sélectionnés
        let activeUserChannelMap = new Map(); // Map des utilisateurs actuellement connectés -> channelId
        let friendDetailsMap = new Map(); // Map des détails des amis (avatars Discord)
        // Données et état pour l'affichage multi-profils par période
        let multiUserStatsData = []; // Tableau d'objets UserStats (résultats API)
        let multiUserSelectedPeriod = 'allTime'; // 'last24h' | 'last7d' | 'last30d' | 'allTime'
        const PERIOD_TABS = [
            { key: 'last24h', label: '24h', icon: '🕐' },
            { key: 'last7d', label: '7j', icon: '📅' },
            { key: 'last30d', label: '30j', icon: '📆' },
            { key: 'allTime', label: 'Total', icon: '⏳' }
        ];
        /**
         * Met à jour l'interface liée à la sélection des utilisateurs et la période courante
         * - Badge de nombre sélectionné
         * - Sous-titre du titre du graphique d'activité utilisateurs
         */
        function updateSelectionUI() {
            const badgeEl = document.getElementById('selectedCountBadge');
            const titleEl = document.getElementById('userChartTitle');
            const count = selectedUserIds.length;
            const countTextBadge = `${count} sélectionné${count > 1 ? 's' : ''}`;
            const countTextSubtitle = count === 0 ? 'aucune sélection' : (count === 1 ? '1 utilisateur' : `${count} utilisateurs`);
            const periodLabelMap = { '24h': '24h', 'week': 'Semaine', 'month': 'Mois' };
            const periodLabel = periodLabelMap[userWindow] || 'Mois';
            if (badgeEl) badgeEl.textContent = countTextBadge;
            if (titleEl) titleEl.setAttribute('data-sub', `${periodLabel} · ${countTextSubtitle}`);
        }

        /**
         * Ajuste la luminosité d'une couleur hexadécimale en préservant la teinte
         * @param {string} color - Couleur hex (#RRGGBB ou #RRGGBBAA)
         * @param {number} percent - Pourcentage d'ajustement (positif = éclaircir, négatif = assombrir)
         * @returns {string} Couleur ajustée en hex
         */
        function adjustBrightness(color, percent) {
            // Retirer le # et gérer l'alpha si présent
            let hex = color.replace('#', '');
            let alpha = '';
            if (hex.length === 8) {
                alpha = hex.slice(6, 8);
                hex = hex.slice(0, 6);
            } else if (hex.length === 3) {
                hex = hex.split('').map(c => c + c).join('');
            }

            // Convertir en RGB
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);

            // Ajuster chaque composante proportionnellement pour préserver la teinte
            const factor = percent < 0 ? (100 + percent) / 100 : 1 + percent / 100;
            
            const newR = Math.max(0, Math.min(255, Math.round(r * factor)));
            const newG = Math.max(0, Math.min(255, Math.round(g * factor)));
            const newB = Math.max(0, Math.min(255, Math.round(b * factor)));

            // Reconvertir en hex
            const result = '#' + 
                newR.toString(16).padStart(2, '0') +
                newG.toString(16).padStart(2, '0') +
                newB.toString(16).padStart(2, '0') +
                alpha;

            return result.toUpperCase();
        }
        // États d'affichage
        let overviewWindow = 'week'; // '24h' | 'week' | 'month' - Défaut: semaine
        let userWindow = '12h';     // '6h' | '12h' | '24h' | 'week' | 'month' - Défaut: 12h
        let dashboardMinTs = null;    // timestamp du 1er point de données (overview)        // --- GRAPHIQUES APEXCHARTS (Initialisation avec des données vides) ---
        const overviewChartOptions = {
            chart: {
                id: 'overviewChartMain',
                type: 'line',
                height: 300,
                toolbar: { 
                    autoSelected: 'zoom',
                    show: false
                }
            },
            series: [], // Les données seront chargées dynamiquement
            noData: { text: 'Chargement des données...' },
            xaxis: {
                type: 'datetime',
                labels: { 
                    show: false,
                    datetimeUTC: false // Force l'affichage dans le fuseau horaire local
                },
                axisTicks: { show: false },
                tooltip: { enabled: false }
            },
            yaxis: {
                min: 0, // Fait commencer l'axe Y à 0
                title: { text: 'Nombre de membres' }
            },
            tooltip: { x: { format: 'dd MMM yyyy HH:mm' } },
            legend: { position: 'top', horizontalAlign: 'right' },
            stroke: {
                curve: 'stepline'
            }
        };

        const overviewBrushOptions = {
            chart: {
                id: 'overviewBrush',
                type: 'area',
                height: 200,
                brush: {
                    target: 'overviewChartMain', // Lie ce graphique au graphique principal
                    enabled: true
                },
                selection: {
                    enabled: true,
                    xaxis: {
                        min: new Date().getTime(),
                        max: new Date().getTime()
                    }
                },
            },
            colors: ['#3699ff'],
            series: [],
            xaxis: {
                type: 'datetime',
                labels: {
                    datetimeUTC: false // Force l'affichage dans le fuseau horaire local
                },
                 tooltip: {
                    enabled: true
                }
            },
            yaxis: {
                labels: {
                    show: false
                }
            },
            grid: {
                yaxis: {
                    lines: { show: false }
                }
            },
            stroke: {
                curve: 'stepline'
            }
        };

        const userChartOptions = {
            chart: {
                type: 'rangeBar',
                height: '100%'
            },
            plotOptions: {
                bar: {
                    horizontal: true,
                    barHeight: '80%',
                    rangeBarGroupRows: true
                }
            },
            series: [], // Les données seront chargées dynamiquement
            noData: { text: 'Sélectionnez un utilisateur pour voir son activité.' },
            xaxis: {
                type: 'datetime',
                labels: {
                    datetimeUTC: false // Force l'affichage dans le fuseau horaire local
                }
            },
            yaxis: {
                // Les catégories seront définies dynamiquement
            },
            tooltip: {
                custom: function({ seriesIndex, dataPointIndex, w }) {
                    try {
                        const s = w.config.series[seriesIndex];
                        const point = s.data[dataPointIndex] || {};
                        let startMs, endMs;

                        if (point && Array.isArray(point.y)) {
                            [startMs, endMs] = point.y;
                        } else if (w.globals && w.globals.seriesRangeStart && w.globals.seriesRangeEnd) {
                            startMs = w.globals.seriesRangeStart[seriesIndex]?.[dataPointIndex];
                            endMs = w.globals.seriesRangeEnd[seriesIndex]?.[dataPointIndex];
                        }

                        if (!startMs || !endMs) {
                            return '';
                        }

                        const durationMs = Math.max(0, endMs - startMs);
                        const hours = Math.floor(durationMs / 3600000);
                        const minutes = Math.floor((durationMs % 3600000) / 60000);
                        let durationStr = '';
                        if (hours > 0) durationStr += `${hours}h `;
                        if (minutes > 0) durationStr += `${minutes}min`;
                        if (durationStr === '' && durationMs > 0) durationStr = '< 1min';
                        if (durationStr === '') durationStr = 'Instant';

                        const userLabel = typeof point.x === 'string' ? point.x : '';
                        const channelName = s && s.name ? s.name : '';
                        const startStr = new Date(startMs).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                        const endStr = new Date(endMs).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

                        return `
                          <div class="apexcharts-tooltip-range">
                            <div><strong>${userLabel}</strong>${channelName ? ` — ${channelName}` : ''}</div>
                            <div>${startStr} → ${endStr}</div>
                            <div>Durée: ${durationStr.trim()}</div>
                          </div>
                        `;
                    } catch (e) {
                        console.warn('Tooltip render error:', e);
                        return '';
                    }
                }
            },
            legend: { show: false }
        };

        const overviewChart = new ApexCharts(document.querySelector("#overviewChart"), overviewChartOptions);
        const overviewChartBrush = new ApexCharts(document.querySelector("#overviewChartBrush"), overviewBrushOptions);
        const userChart = new ApexCharts(document.querySelector("#userChart"), userChartOptions);
        overviewChart.render();
        overviewChartBrush.render();
        userChart.render();

        // --- DOM ELEMENTS & HELPERS ---
        const loader = document.getElementById('loader');
        const showLoader = () => {
            if (loader) loader.style.display = 'flex';
        };
        const hideLoader = () => {
            if (loader) loader.style.display = 'none';
        };


        // --- LOGIQUE DE L'APPLICATION ---

        /**
         * Récupère les données d'activité depuis l'API.
         */
        async function fetchApiData(guildId, startDate, endDate) {
            let url = `${API_BASE_URL}/dashboard/guilds/${guildId}/activity`;
            // Ajouter les paramètres de date seulement s'ils sont fournis
            if (startDate && endDate) {
                url += `?start=${startDate.toISOString()}&end=${endDate.toISOString()}`;
            }
            try {
                const response = await makeFetchRequest(url);
                if (!response.ok) {
                    throw new Error(`Erreur API: ${response.statusText}`);
                }
                return await response.json();
            } catch (error) {
                console.error("Impossible de récupérer les données :", error);
                overviewChart.updateOptions({ noData: { text: 'Erreur lors du chargement des données.' } });
                throw error; // Renvoyer l'erreur pour qu'elle soit traitée par l'appelant
            }
        }

        /**
         * Transforme les données de l'API pour le graphique d'aperçu (Overview).
         */
        function processOverviewData(data, channelNamesMap) {
             const seriesMap = new Map();
 
             // 1. Initialiser toutes les séries possibles en parcourant une fois les données.
             data.forEach(record => {
                 record.channels.forEach(channel => {
                     if (!seriesMap.has(channel.channelId)) {
                         seriesMap.set(channel.channelId, {
                             id: channel.channelId,
                             name: channelNamesMap.get(channel.channelId) || channel.channelName || `Canal ${channel.channelId}`,
                             data: []
                         });
                     }
                 });
             });
 
             // 2. Parcourir chaque enregistrement temporel pour construire les séries.
             data.forEach(record => {
                 const timestamp = new Date(record.sessionStart).getTime();
                 const channelsInRecord = new Map(record.channels.map(c => [c.channelId, c.members.length]));
 
                 // Pour chaque canal qui a déjà existé...
                 seriesMap.forEach((series, channelId) => {
                     const memberCount = channelsInRecord.get(channelId) || 0;
                     const value = memberCount > 0 ? memberCount : null; // On utilise null pour les valeurs zéro
 
                     const lastPoint = series.data.length > 0 ? series.data[series.data.length - 1] : null;
                     const lastValue = lastPoint ? lastPoint[1] : null;
 
                     // Si l'état du canal a changé...
                     if (lastValue !== value) {
                        // On ajoute un point "fictif" pour maintenir la ligne jusqu'à ce moment précis.
                        if (lastPoint && lastPoint[0] < timestamp) {
                            // On ne dessine un point fictif que si la ligne n'était pas déjà cassée (null)
                            if (lastValue !== null) {
                                series.data.push([timestamp, lastValue]);
                                // CAS SPECIAL: si on passe de >0 à 0 (null), on ajoute le point 0 avant le null.
                                if (value === null) {
                                    series.data.push([timestamp, 0]);
                                }
                            } 
                            // NOUVEAU CAS: si la ligne était cassée (null) et devient active
                            else if (value !== null) {
                                series.data.push([timestamp, 0]);
                            }
                        }
                        // Puis on ajoute le point du nouvel état.
                        series.data.push([timestamp, value]);
                     }
                 });
             });
 
             const allSeries = Array.from(seriesMap.values());
 
             const sortedSeries = allSeries.sort((a, b) => {
                 const orderA = CHANNEL_ORDER.indexOf(a.id);
                 const orderB = CHANNEL_ORDER.indexOf(b.id);
                 if (orderA !== -1 && orderB !== -1) return orderA - orderB;
                 if (orderA !== -1) return -1;
                 if (orderB !== -1) return 1;
                 return a.name.localeCompare(b.name);
             });
 
             // Filtrer les séries qui n'ont jamais eu de membres (tous les points sont `null`).
             return sortedSeries.filter(series => series.data.some(point => point[1] !== null));
         }
 
        /**
         * Extends each series in a dataset to a final timestamp.
         * For stepline charts, this draws a horizontal line from the last data point to the end time.
         * @param {Array} series - The array of series data from ApexCharts.
         * @param {number} extendUntil - The timestamp (in ms) to extend the lines to.
         */
        function extendSeriesTo(series, extendUntil) {
            series.forEach(s => {
                if (s.data.length > 0) {
                    const lastPoint = s.data[s.data.length - 1];
                    const lastValue = lastPoint[1];
                    s.data.push([extendUntil, lastValue]);
                }
            });
            return series;
        }

        /**
         * Transforme les données de l'API pour le graphique de la brush (Total des membres).
         */
        function processTotalMembersData(data) {
            const totalMembersData = [];
            for (let i = 0; i < data.length; i++) {
                const record = data[i];
                const start = new Date(record.sessionStart).getTime();
                const totalMembers = record.channels.reduce((sum, channel) => sum + channel.members.length, 0);

                const lastPoint = totalMembersData.length > 0 ? totalMembersData[totalMembersData.length - 1] : null;
                // Add a point only if the state has changed
                if (!lastPoint || lastPoint[1] !== totalMembers) {
                    totalMembersData.push([start, totalMembers]);
                }

                // If the session ends and there's a gap before the next one, add a zero point
                if (record.sessionEnd) {
                    const end = new Date(record.sessionEnd).getTime();
                    const nextRecord = data[i + 1];
                    if (!nextRecord || end < new Date(nextRecord.sessionStart).getTime()) {
                        if (totalMembersData.length > 0 && totalMembersData[totalMembersData.length - 1][1] !== 0) {
                            totalMembersData.push([end, 0]);
                        }
                    }
                }
            }

            return [{
                name: 'Total des membres',
                data: totalMembersData
            }];
        }

        /**
         * Génère des annotations (lignes et zones) pour les graphiques.
         * @param {Date} startDate - La date de début de la plage d'annotations.
         * @param {Date} endDate - La date de fin de la plage d'annotations.
         * @returns {object} Un objet d'annotations pour ApexCharts.
         */
        function generateAnnotations(startDate, endDate) {
            const annotations = {
                xaxis: [],
            };
            const now = new Date().getTime();

            // 1. Ligne rouge pour "maintenant"
            annotations.xaxis.push({
                x: now,
                strokeDashArray: 2,
                borderColor: 'var(--danger)',
                label: {
                    borderColor: 'var(--danger)',
                    style: {
                        color: '#fff',
                        background: 'var(--danger)',
                        fontSize: '10px',
                        padding: { left: 5, right: 5, top: 2, bottom: 2 }
                    },
                    text: 'Maintenant',
                }
            });

            // 2. Générer les plages jour/nuit
            let currentDate = new Date(startDate);
            currentDate.setHours(0, 0, 0, 0); // Démarrer au début du premier jour

            while (currentDate <= endDate) {
                // Plage jaune pour la "journée active" (8h à 18h)
                const dayStart = new Date(currentDate);
                dayStart.setHours(8, 0, 0, 0);
                const dayEnd = new Date(currentDate);
                dayEnd.setHours(18, 0, 0, 0);

                annotations.xaxis.push({
                    x: dayStart.getTime(),
                    x2: dayEnd.getTime(),
                    fillColor: 'var(--warning)',
                    opacity: 0.1
                });

                // Plage bleu clair pour la "nuit" (23h à 7h le lendemain)
                const nightStart = new Date(currentDate);
                nightStart.setHours(23, 0, 0, 0);
                const nextDay = new Date(currentDate);
                nextDay.setDate(nextDay.getDate() + 1);
                const nightEnd = new Date(nextDay);
                nightEnd.setHours(7, 0, 0, 0);

                annotations.xaxis.push({
                    x: nightStart.getTime(),
                    x2: nightEnd.getTime(),
                    fillColor: 'var(--sidebar-active)',
                    opacity: 0.1
                });

                // Passer au jour suivant
                currentDate.setDate(currentDate.getDate() + 1);
            }

            return annotations;
        }

        /**
         * Formate un timestamp en une chaîne de caractères représentant le temps écoulé.
         * @param {number} timestamp - Le timestamp de la dernière activité.
         * @returns {string} Une chaîne formatée (ex: "-5min", "-2h", "-1j").
         */
        function formatTimeSince(timestamp) {
            const now = new Date().getTime();
            const diffMs = now - timestamp;

            const diffDays = Math.floor(diffMs / 86400000); // 1000 * 60 * 60 * 24
            if (diffDays > 0) return `-${diffDays}j`;

            const diffHours = Math.floor(diffMs / 3600000); // 1000 * 60 * 60
            if (diffHours > 0) return `-${diffHours}h`;

            const diffMinutes = Math.floor(diffMs / 60000); // 1000 * 60
            if (diffMinutes > 0) return `-${diffMinutes}min`;

            return "à l'instant";
        }

        /**
         * Extrait une liste unique d'utilisateurs à partir des données de l'API.
         */
        function extractUsers(data) {
            const users = [];
            const seenUserIds = new Set();

            // Itérer à l'envers pour trouver la dernière activité de chaque utilisateur en premier
            for (let i = data.length - 1; i >= 0; i--) {
                const record = data[i];
                // La dernière activité est la fin de la session, ou son début si elle est en cours.
                const lastActivityTime = record.sessionEnd ? new Date(record.sessionEnd).getTime() : new Date(record.sessionStart).getTime();
                for (const channel of record.channels) {
                    for (const member of channel.members) {
                        if (!seenUserIds.has(member.userId)) {
                            seenUserIds.add(member.userId);
                            users.push({ id: member.userId, name: member.username, lastActivity: lastActivityTime });
                        }
                    }
                }
            }
            return users; // Déjà trié par dernière activité (desc)
        }

        /**
         * Extrait une liste unique de canaux à partir des données de l'API.
         */
        function extractChannels(data, channelNamesMap) {
             const channelsFromData = new Map();
             // 1. Récupérer les noms de tous les canaux qui ont eu une activité.
             data.forEach(record => {
                 record.channels.forEach(channel => {
                     if (!channelsFromData.has(channel.channelId)) {
                         channelsFromData.set(channel.channelId, {
                             id: channel.channelId,
                             name: channelNamesMap.get(channel.channelId) || channel.channelName || `Canal ${channel.channelId}`
                         });
                     }
                 });
             });
 
             // 2. Construire la liste finale en se basant sur CHANNEL_ORDER pour garantir que tous les canaux y sont.
             const finalChannelsList = CHANNEL_ORDER.map(channelId => {
                 const existingChannel = channelsFromData.get(channelId);
                 // Si un canal de la liste d'ordre n'a jamais eu d'activité, on crée un placeholder avec le nom frais si disponible.
                 return existingChannel || { id: channelId, name: channelNamesMap.get(channelId) || `Canal ${channelId}` };
             });
 
             // 3. Ajouter les autres canaux qui ont eu une activité mais ne sont pas dans la liste d'ordre.
             channelsFromData.forEach(channel => {
                 if (!CHANNEL_ORDER.includes(channel.id)) {
                     finalChannelsList.push(channel);
                 }
             });
 
             return finalChannelsList;
        }
        /**
         * Remplit la liste des utilisateurs et le menu déroulant.
         */
        async function populateUsersList(users, activeUserChannelMap) {
            const usersListContainer = document.getElementById('usersList');
            usersListContainer.innerHTML = ''; // Vider la liste existante

            if (users.length === 0) return;

            const userIds = users.map(u => u.id);

            try {
                const response = await makeFetchRequest(`${API_BASE_URL}/dashboard/guilds/${GUILD_ID}/users/bulk`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userIds }),
                });

                if (!response.ok) {
                    throw new Error(`La requête bulk a échoué: ${response.statusText}`);
                }

                const detailedUsers = await response.json();
                const detailedUsersMap = new Map(detailedUsers.map(u => [u.id, u]));

                users.forEach(basicUser => {
                    const button = document.createElement('button');
                    button.className = 'channel-card';
                    button.dataset.userId = basicUser.id;

                    const detailedUser = detailedUsersMap.get(basicUser.id);

                    // --- Avatar Section ---
                    const avatarWrapper = document.createElement('div');
                    avatarWrapper.className = 'avatar-wrapper';

                    // Avatar image
                    const avatarUrl = detailedUser ? detailedUser.avatar : 'https://cdn.discordapp.com/embed/avatars/0.png';
                    const avatarImg = document.createElement('img');
                    avatarImg.className = 'user-avatar';
                    avatarImg.src = avatarUrl;
                    avatarImg.alt = `Avatar de ${basicUser.name}`;
                    avatarWrapper.appendChild(avatarImg);

                    // Avatar Decoration (if it exists)
                    if (detailedUser && detailedUser.avatarDecoration) {
                        const decorationImg = document.createElement('img');
                        decorationImg.className = 'user-avatar-decoration';
                        decorationImg.src = detailedUser.avatarDecoration;
                        avatarWrapper.appendChild(decorationImg);
                    }
                    button.appendChild(avatarWrapper);

                    // Info container
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'user-info';

                    // Nickname (Line 1)
                    const nicknameSpan = document.createElement('span');
                    nicknameSpan.className = 'user-nickname';
                    nicknameSpan.textContent = detailedUser ? (detailedUser.nickname || detailedUser.username) : basicUser.name;
                    infoDiv.appendChild(nicknameSpan);

                    // Tag (Line 2)
                    const tagSpan = document.createElement('span');
                    tagSpan.className = 'user-tag';
                    if (detailedUser) {
                        if (detailedUser.discriminator && detailedUser.discriminator !== '0') {
                            tagSpan.textContent = `@${detailedUser.username}#${detailedUser.discriminator}`;
                        } else {
                            tagSpan.textContent = `@${detailedUser.username}`;
                        }
                    } else {
                        tagSpan.textContent = `@${basicUser.name}`;
                    }
                    infoDiv.appendChild(tagSpan);

                    button.appendChild(infoDiv);

                    // Ajouter l'indicateur de statut (bulle ou texte)
                    if (activeUserChannelMap.has(basicUser.id)) {
                        const channelId = activeUserChannelMap.get(basicUser.id);
                        const channelColor = CHANNEL_COLORS[channelId] || '#1bc5bd'; // Fallback
                        const statusBubble = document.createElement('div');
                        statusBubble.className = 'user-status-bubble';
                        statusBubble.style.backgroundColor = channelColor;

                        // Ajouter le nom du salon en tooltip
                        const activeChannel = allChannels.find(c => c.id === channelId);
                        if (activeChannel) {
                            statusBubble.title = activeChannel.name;
                        }
                        button.appendChild(statusBubble);
                    } else {
                        const inactiveStatusText = document.createElement('span');
                        inactiveStatusText.className = 'user-inactive-status';
                        inactiveStatusText.textContent = formatTimeSince(basicUser.lastActivity);

                        // Ajouter la date et l'heure exactes en tooltip
                        const lastActivityDate = new Date(basicUser.lastActivity);
                        inactiveStatusText.title = lastActivityDate.toLocaleString('fr-FR');
                        button.appendChild(inactiveStatusText);
                    }
                    usersListContainer.appendChild(button);
                });

                // Après avoir ajouté toutes les cartes au DOM, on vérifie les pseudos qui dépassent
                const userCards = usersListContainer.querySelectorAll('.channel-card');
                userCards.forEach(card => {
                    const nicknameSpan = card.querySelector('.user-nickname');
                    if (nicknameSpan && nicknameSpan.scrollWidth > nicknameSpan.clientWidth) {
                        nicknameSpan.classList.add('is-overflowing');
                        // On calcule la distance de défilement nécessaire
                        const scrollDistance = nicknameSpan.scrollWidth - nicknameSpan.clientWidth;
                        // On la définit comme une variable CSS pour l'animation
                        nicknameSpan.style.setProperty('--scroll-x', `-${scrollDistance}px`);
                    }
                });

            } catch (err) {
                console.error("Impossible de récupérer les détails des utilisateurs en masse, affichage de base.", err);
                // Fallback to basic display if bulk fails
                users.forEach(user => {
                    const button = document.createElement('button');
                    button.className = 'channel-card';
                    button.dataset.userId = user.id;
                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = user.name;
                    button.appendChild(nameSpan);
                    usersListContainer.appendChild(button);
                });
            }
        }

async function fetchUserDetails(userIds) {
    const userDetailsMap = new Map();
    try {
        // Utiliser la requête authentifiée pour éviter le fallback 'User 123'
        const response = await makeFetchRequest(`${API_BASE_URL}/dashboard/guilds/${GUILD_ID}/users/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds }),
        });
        if (response && response.ok) {
            const users = await response.json();
            users.forEach(u => {
                const displayName = u.nickname || u.username || `Utilisateur ${u.id.slice(-4)}`;
                userDetailsMap.set(u.id, displayName);
            });
        }
    } catch (err) {
        console.error("Failed to fetch user details for chart series", err);
    }
    // Fallback pour les utilisateurs non trouvés dans la réponse API
    userIds.forEach(id => {
        if (!userDetailsMap.has(id)) {
            userDetailsMap.set(id, `Utilisateur ${id.slice(-4)}`);
        }
    });
    return userDetailsMap;
}

function processUserActivity(userIds, selectedUsersMap) {
    const now = new Date().getTime();
    const seriesDataMap = new Map();
    // Initialiser un état de session pour chaque utilisateur sélectionné
    const userSessionStates = new Map(userIds.map(id => [id, { currentSession: null, mergedSessions: [] }]));

    // Parcourir les données brutes UNE SEULE FOIS
    rawApiData.forEach(record => {
        const startTime = new Date(record.sessionStart).getTime();
        const endTime = record.sessionEnd ? new Date(record.sessionEnd).getTime() : now;

        // Créer une map rapide de la présence des utilisateurs dans ce record
        const userChannelMap = new Map();
        record.channels.forEach(channel => {
            channel.members.forEach(member => {
                if (userSessionStates.has(member.userId)) { // On ne traite que les utilisateurs sélectionnés
                    userChannelMap.set(member.userId, channel.channelId);
                }
            });
        });

        // Mettre à jour l'état de session pour chaque utilisateur
        userSessionStates.forEach((state, userId) => {
            const channelIdForUser = userChannelMap.get(userId);

            if (channelIdForUser) {
                // L'utilisateur est dans un canal
                if (state.currentSession && state.currentSession.channelId === channelIdForUser && state.currentSession.endTime === startTime) {
                    // L'utilisateur est toujours dans le même canal, on étend la session
                    state.currentSession.endTime = endTime;
                } else {
                    // L'utilisateur a changé de canal ou une nouvelle session commence
                    if (state.currentSession) {
                        state.mergedSessions.push(state.currentSession);
                    }
                    state.currentSession = {
                        channelId: channelIdForUser,
                        startTime: startTime,
                        endTime: endTime
                    };
                }
            } else {
                // L'utilisateur n'est dans aucun canal dans cet enregistrement
                if (state.currentSession) {
                    // L'utilisateur vient de se déconnecter, on clôture la session
                    state.mergedSessions.push(state.currentSession);
                    state.currentSession = null;
                }
            }
        });
    });

    // Après avoir parcouru tous les enregistrements, on ajoute les sessions encore en cours
    userSessionStates.forEach(state => {
        if (state.currentSession) {
            state.mergedSessions.push(state.currentSession);
        }
    });

    // Construire les données de série finales à partir des sessions fusionnées
    userSessionStates.forEach((state, userId) => {
        // Utiliser le vrai nom récupéré, sinon fallback plus explicite
        const resolvedUserName = selectedUsersMap.get(userId) || `Utilisateur ${userId.slice(-4)}`;
        state.mergedSessions.forEach(session => {
            const channelInfo = allChannels.find(c => c.id === session.channelId);
            if (channelInfo) {
                if (!seriesDataMap.has(channelInfo.id)) {
                    seriesDataMap.set(channelInfo.id, {
                        name: channelInfo.name,
                        data: []
                    });
                }
                seriesDataMap.get(channelInfo.id).data.push({
                    x: resolvedUserName,
                    y: [session.startTime, session.endTime],
                    _meta: { userId } // conserve l'ID pour un usage futur (tooltip avancé, etc.)
                });
            }
        });
    });

    return seriesDataMap;
}

/**
 * Met à jour le graphique utilisateur pour les userIds sélectionnés.
 */
async function updateUserChartFor(userIds) {
    if (!userIds || userIds.length === 0) {
        userChart.updateSeries([]); // Vider le graphique si aucun utilisateur n'est sélectionné
        userChart.updateOptions({ yaxis: { categories: [] } });
        return;
    }

    const now = new Date().getTime();
    // Fenêtre selon le bouton actif
    let windowMs;
    if (userWindow === '6h') {
        windowMs = 6 * 60 * 60 * 1000;
    } else if (userWindow === '12h') {
        windowMs = 12 * 60 * 60 * 1000;
    } else if (userWindow === '24h') {
        windowMs = 24 * 60 * 60 * 1000;
    } else if (userWindow === 'week') {
        windowMs = 7 * 24 * 60 * 60 * 1000;
    } else {
        windowMs = 30 * 24 * 60 * 60 * 1000;
    }
    const windowStart = now - windowMs;

    // 1. Récupérer les détails des utilisateurs (noms)
    const selectedUsersMap = await fetchUserDetails(userIds);

    // 2. Traiter les données d'activité pour construire les séries
    const seriesDataMap = processUserActivity(userIds, selectedUsersMap);

    // 3. Formater les données pour ApexCharts
    const finalSeries = Array.from(seriesDataMap.values());
    const finalColors = Array.from(seriesDataMap.keys()).map(channelId => CHANNEL_COLORS[channelId] || '#9E9E9E');
    // Y Axis categories: conserver l'ordre des userIds fournis, en mappant vers le nom résolu
    const yAxisCategories = userIds.map(id => selectedUsersMap.get(id) || `Utilisateur ${id.slice(-4)}`);

    // 4. Générer les annotations pour la fenêtre choisie
    const userAnnotations = generateAnnotations(new Date(windowStart), new Date(now));

    // 5. Mettre à jour le graphique
    userChart.updateOptions({
        xaxis: { min: windowStart, max: now },
        yaxis: {
            categories: yAxisCategories,
            reversed: false // Les utilisateurs sont listés de haut en bas
        },
        annotations: userAnnotations,
        colors: finalColors,
        legend: { show: true, position: 'top', horizontalAlign: 'left' }
    });

    userChart.updateSeries(finalSeries);
}
        /**
         * Affiche les cartes de statistiques pour un ou plusieurs utilisateurs sélectionnés.
         * @param {string|string[]} userIds - Un seul userId ou un tableau d'userIds
         */
        async function displayUserStats(userIds) {
            const container = document.getElementById('userStatsContainer');
            
            // Normaliser en tableau
            if (!userIds || (Array.isArray(userIds) && userIds.length === 0)) {
                container.style.display = 'none';
                return;
            }
            
            const userIdArray = Array.isArray(userIds) ? userIds : [userIds];
            
            container.style.display = 'block';
            container.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> Chargement des statistiques...</div>`;

            try {
                // Helper pour attendre
                const wait = (ms) => new Promise(res => setTimeout(res, ms));
                
                // Fonction pour charger les stats d'un seul utilisateur
                const fetchUserStats = async (userId) => {
                    // 1) Tentative initiale de récupération des stats
                    let response = await makeFetchRequest(`${API_BASE_URL}/dashboard/guilds/${GUILD_ID}/users/${userId}/stats`);

                    // 2) Si 404, tenter de déclencher un calcul à la demande puis re-poller
                    if (response && response.status === 404) {
                        // Déclencher le calcul côté backend (endpoint dédié dashboard, retour 202 immédiat)
                        let postResp = await makeFetchRequest(`${API_BASE_URL}/dashboard/guilds/${GUILD_ID}/users/${userId}/stats/update`, { method: 'POST' });
                        // Si la route n'existe pas encore côté serveur (404), tenter l'ancien endpoint de secours
                        if (!postResp || postResp.status === 404) {
                            postResp = await makeFetchRequest(`${API_BASE_URL}/user/update/${GUILD_ID}/${userId}`, { method: 'POST' });
                        }

                        // Re-poll jusqu'à 8 fois (1s d'intervalle)
                        let retries = 8;
                        while (retries-- > 0) {
                            await wait(1000);
                            response = await makeFetchRequest(`${API_BASE_URL}/dashboard/guilds/${GUILD_ID}/users/${userId}/stats`);
                            if (response && response.ok) break;
                        }
                    }

                    // 3) Retourner résultat ou erreur
                    if (!response || !response.ok) {
                        const errorData = response ? (await response.json().catch(() => ({}))) : {};
                        return { 
                            error: true, 
                            userId, 
                            message: errorData.message || 'Impossible de charger les statistiques'
                        };
                    }

                    return await response.json();
                };
                
                // Charger toutes les stats en parallèle
                const results = await Promise.all(userIdArray.map(id => fetchUserStats(id)));
                
                // Séparer les succès et les erreurs
                const successData = results.filter(r => !r.error);
                const errorData = results.filter(r => r.error);

                // Récupérer les IDs de tous les amis pour charger leurs avatars Discord
                const allFriendIds = new Set();
                successData.forEach(data => {
                    if (data.stats) {
                        Object.values(data.stats).forEach(periodStats => {
                            if (periodStats.bestFriends) {
                                periodStats.bestFriends.forEach(friend => {
                                    allFriendIds.add(friend.userId);
                                });
                            }
                        });
                    }
                });

                // Charger les détails des amis (avatars Discord)
                friendDetailsMap = new Map(); // Utiliser la variable globale
                if (allFriendIds.size > 0) {
                    try {
                        const friendResponse = await makeFetchRequest(`${API_BASE_URL}/dashboard/guilds/${GUILD_ID}/users/bulk`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userIds: Array.from(allFriendIds) }),
                        });
                        if (friendResponse && friendResponse.ok) {
                            const friendDetails = await friendResponse.json();
                            friendDetailsMap = new Map(friendDetails.map(u => [u.id, u]));
                        }
                    } catch (err) {
                        console.error("Impossible de récupérer les avatars des amis:", err);
                    }
                }

                // Mémoriser les données pour rendu par période
                multiUserStatsData = successData;

                const formatMs = (ms) => {
                    if (!ms || ms < 1000) return `0s`;
                    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
                    const minutes = Math.floor(ms / 60000);
                    const hours = Math.floor(minutes / 60);
                    if (hours < 1) return `${minutes}min`;
                    const days = Math.floor(hours / 24);
                    if (days < 1) return `${hours}h ${minutes % 60}min`;
                    return `${days}j ${hours % 24}h`;
                };

                const statsPeriods = [
                    { key: 'last24h', label: '24h', icon: '🕐' },
                    { key: 'last7d', label: '7j', icon: '📅' },
                    { key: 'last30d', label: '30j', icon: '📆' },
                    { key: 'allTime', label: 'Total', icon: '⏳' }
                ];

                const buildCompactPeriodCard = (period, stats) => {
                    return `
                        <div class="period-card-compact">
                            <div class="period-stats-compact">
                                <div class="stat-label-compact">Total période</div>
                                <div class="stat-value-compact">${formatMs(stats.timeSpent)}</div>
                            </div>
                        </div>
                        <div class="period-card-compact">
                            <div class="period-stats-compact">
                                <div class="stat-label-compact">Total seul</div>
                                <div class="stat-value-compact">${formatMs(stats.timeSpentAlone)}</div>
                            </div>
                        </div>
                    `;
                };

                const buildUserCard = (data) => {
                    const tag = data.discriminator !== '0' ? `${data.username}#${data.discriminator}` : `${data.username}`;
                    const lastUpdate = new Date(data.lastUpdatedAt).toLocaleString('fr-FR', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });

                    // Déterminer la couleur du header selon l'état de connexion
                    const channelId = activeUserChannelMap.get(data.userId);
                    const channelColor = channelId ? (CHANNEL_COLORS[channelId] || '#667eea') : '#6c757d';
                    const headerGradient = `linear-gradient(135deg, ${channelColor} 0%, ${adjustBrightness(channelColor, -20)} 100%)`;

                    // Déterminer le statut de connexion
                    const isActive = activeUserChannelMap.has(data.userId);
                    const lastActivityText = isActive 
                        ? '<span class="status-active"><i class="fas fa-circle"></i> Actif</span>'
                        : data.lastActivity 
                            ? `Dernière connexion: ${new Date(data.lastActivity).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                            : '';

                    return `
                        <div class="user-stats-card">
                            <div class="user-card-header" style="background: ${headerGradient};">
                                <img src="${data.avatar}" 
                                     alt="${data.username}" 
                                     class="user-card-avatar"
                                     onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                                <div class="user-card-info">
                                    <h3 class="user-card-nickname">${data.nickname || data.username}</h3>
                                    <p class="user-card-username">${tag}</p>
                                    ${data.isBot ? '<span class="bot-badge-small"><i class="fas fa-robot"></i></span>' : ''}
                                </div>
                            </div>
                            
                            <div class="periods-compact-grid">
                                ${statsPeriods.map(period => buildCompactPeriodCard(period, data.stats[period.key])).join('')}
                            </div>
                            
                            ${data.stats.allTime.bestFriends && data.stats.allTime.bestFriends.length > 0 ? `
                                <div class="top-friends-compact">
                                    <div class="top-friends-header">
                                        <i class="fas fa-user-friends"></i>
                                        <span>Top 3 Amis</span>
                                    </div>
                                    <div class="friends-compact-list">
                                        ${data.stats.allTime.bestFriends.slice(0, 3).map((friend, idx) => {
                                            const friendDetail = friendDetailsMap.get(friend.userId);
                                            const friendAvatar = friendDetail?.avatar || friend.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
                                            const friendName = friendDetail?.nickname || friendDetail?.username || friend.username;
                                            return `
                                                <div class="friend-compact">
                                                    <span class="friend-rank-compact">#${idx + 1}</span>
                                                    <img src="${friendAvatar}" alt="${friendName}" class="friend-avatar-compact" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                                                    <span class="friend-name-compact">${friendName}</span>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            
                            <div class="user-card-footer">
                                <div><i class="fas fa-sync-alt"></i> Mis à jour: ${lastUpdate}</div>
                                ${lastActivityText ? `<div class="last-activity">${lastActivityText}</div>` : ''}
                            </div>
                        </div>
                    `;
                };

                // Rendu via la fonction dédiée (avec sous-menu de périodes)
                renderMultiUserStats(errorData);
                
            } catch (err) {
                console.error("Erreur lors de l'affichage des stats utilisateur:", err);
                container.innerHTML = `<div class="error">Une erreur est survenue lors de l'affichage des statistiques.</div>`;
            }
        }

        /**
         * Rendu des cartes multi-utilisateurs avec sous-menu de périodes
         * @param {Array} errorData - liste d'erreurs par userId (facultatif)
         */
        function renderMultiUserStats(errorData = []) {
            const container = document.getElementById('userStatsContainer');
            if (!container) return;

            const formatMs = (ms) => {
                if (!ms || ms < 1000) return `0s`;
                if (ms < 60000) return `${Math.round(ms / 1000)}s`;
                const minutes = Math.floor(ms / 60000);
                const hours = Math.floor(minutes / 60);
                if (hours < 1) return `${minutes}min`;
                const days = Math.floor(hours / 24);
                if (days < 1) return `${hours}h ${minutes % 60}min`;
                return `${days}j ${hours % 24}h`;
            };

            const buildUserCardForPeriod = (data, periodKey) => {
                const stats = data.stats?.[periodKey] || { timeSpent: 0, timeSpentAlone: 0, bestFriends: [] };
                const tag = data.discriminator !== '0' ? `${data.username}#${data.discriminator}` : `${data.username}`;
                const lastUpdate = data.lastUpdatedAt ? new Date(data.lastUpdatedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

                // Déterminer la couleur du header selon l'état de connexion
                const channelId = activeUserChannelMap.get(data.userId);
                const channelColor = channelId ? (CHANNEL_COLORS[channelId] || '#667eea') : '#6c757d';
                const headerGradient = `linear-gradient(135deg, ${channelColor} 0%, ${adjustBrightness(channelColor, -20)} 100%)`;

                // Déterminer le statut de connexion
                const isActive = activeUserChannelMap.has(data.userId);
                const lastActivityText = isActive 
                    ? '<span class="status-active"><i class="fas fa-circle"></i> Actif</span>'
                    : data.lastActivity 
                        ? `Dernière connexion: ${new Date(data.lastActivity).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                        : '';

                return `
                    <div class="user-stats-card">
                        <div class="user-card-header" style="background: ${headerGradient};">
                            <img src="${data.avatar}" alt="${data.username}" class="user-card-avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                            <div class="user-card-info">
                                <h3 class="user-card-nickname">${data.nickname || data.username}</h3>
                                <p class="user-card-username">${tag}</p>
                                ${data.isBot ? '<span class="bot-badge-small"><i class="fas fa-robot"></i></span>' : ''}
                            </div>
                        </div>

                        <div class="periods-compact-grid">
                            <div class="period-card-compact">
                            
                                <div class="period-stats-compact">
                                    <div class="stat-label-compact">Total période</div>
                                    <div class="stat-value-compact">${formatMs(stats.timeSpent)}</div>
                                </div>
                            </div>
                            <div class="period-card-compact">
                                
                                <div class="period-stats-compact">
                                    <div class="stat-label-compact">Total seul</div>
                                    <div class="stat-value-compact">${formatMs(stats.timeSpentAlone)}</div>
                                </div>
                            </div>
                        </div>

                        ${stats.bestFriends && stats.bestFriends.length > 0 ? `
                            <div class="top-friends-compact">
                                <div class="top-friends-header"><i class="fas fa-user-friends"></i><span>Top amis (${Math.min(stats.bestFriends.length, 5)})</span></div>
                                <div class="friends-compact-list">
                                    ${stats.bestFriends.slice(0,5).map((friend, idx) => {
                                        const friendDetail = friendDetailsMap.get(friend.userId);
                                        const friendAvatar = friendDetail?.avatar || friend.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
                                        const friendName = friendDetail?.nickname || friendDetail?.username || friend.username;
                                        return `
                                            <div class="friend-compact">
                                                <span class="friend-rank-compact">#${idx + 1}</span>
                                                <img src="${friendAvatar}" alt="${friendName}" class="friend-avatar-compact" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                                                <span class="friend-name-compact">${friendName}</span>
                                                <span class="friend-time-compact">${formatMs(friend.timeSpentTogether)}</span>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <div class="user-card-footer">
                            <div><i class="fas fa-sync-alt"></i> Mis à jour: ${lastUpdate}</div>
                            ${lastActivityText ? `<div class="last-activity">${lastActivityText}</div>` : ''}
                        </div>
                    </div>
                `;
            };

            // Barre de boutons de période
            const buttonsHtml = `
                <div class="period-toggle-bar">
                    ${PERIOD_TABS.map(p => `
                        <button class="period-btn ${multiUserSelectedPeriod === p.key ? 'active' : ''}" data-period="${p.key}">
                            <span class="icon">${p.icon}</span>
                            <span class="label">${p.label}</span>
                        </button>
                    `).join('')}
                </div>
            `;

            // Grille des cartes selon période sélectionnée
            let gridHtml = '';
            if (multiUserStatsData.length > 0) {
                gridHtml += `<div class="multi-user-stats-grid">`;
                gridHtml += multiUserStatsData.map(d => buildUserCardForPeriod(d, multiUserSelectedPeriod)).join('');
                gridHtml += `</div>`;
            }

            const errorHtml = (errorData && errorData.length > 0) ? `
                <div class="error-users">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${errorData.length} utilisateur(s) sans statistiques disponibles</p>
                </div>
            ` : '';

            container.innerHTML = buttonsHtml + gridHtml + errorHtml;

            // Wiring: clic sur les boutons de période
            const btns = container.querySelectorAll('.period-btn');
            btns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const newPeriod = btn.getAttribute('data-period');
                    if (newPeriod && newPeriod !== multiUserSelectedPeriod) {
                        multiUserSelectedPeriod = newPeriod;
                        renderMultiUserStats(errorData);
                    }
                });
            });
        }

        /**
         * Fonction principale pour initialiser le tableau de bord.
         */
        async function initializeDashboard() {
            showLoader();
            const now = new Date().getTime(); // Heure actuelle

            try {
                // On charge l'historique complet sans spécifier de dates
                rawApiData = await fetchApiData(GUILD_ID);

                if (rawApiData.length > 0) {
                    // --- Optimisation : Récupérer les noms de canaux à jour en une seule fois ---
                    // On s'assure de récupérer les noms pour les canaux de la DB ET ceux de notre liste d'ordre.
                    const allChannelIdsInData = [...new Set(rawApiData.flatMap(r => r.channels.map(c => c.channelId)))];
                    const allRelevantChannelIds = [...new Set([...allChannelIdsInData, ...CHANNEL_ORDER])];
                    let freshChannelNamesMap = new Map();
                    try {
                        const freshChannelDetails = await makeFetchRequest(`${API_BASE_URL}/dashboard/guilds/${GUILD_ID}/channels/bulk`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ channelIds: allRelevantChannelIds }),
                        }).then(res => res.ok ? res.json() : []);
                        freshChannelNamesMap = new Map(freshChannelDetails.map(c => [c.id, c.name]));
                    } catch (err) {
                        console.error("Impossible de récupérer les noms de canaux à jour. Utilisation des noms de la base de données.", err);
                    }
                    // --- Fin de l'optimisation ---

                    // Mettre à jour le graphique d'aperçu (détaillé par canal) et l'étendre jusqu'à maintenant
                    let overviewSeries = processOverviewData(rawApiData, freshChannelNamesMap);
                    overviewSeries = extendSeriesTo(overviewSeries, now);

                    // Extraire les couleurs correspondantes dans le bon ordre
                    const overviewColors = overviewSeries.map(series => CHANNEL_COLORS[series.id] || '#9E9E9E'); // Gris par défaut
                    overviewChart.updateOptions({
                        series: overviewSeries,
                        colors: overviewColors
                    });

                    // Mettre à jour le graphique de la brush (total des membres) et l'étendre jusqu'à maintenant
                    let brushSeries = processTotalMembersData(rawApiData);
                    brushSeries = extendSeriesTo(brushSeries, now);
                    overviewChartBrush.updateSeries(brushSeries);

                    // Remplir la liste des utilisateurs
                    const users = extractUsers(rawApiData);
                    // Extraire les canaux pour l'axe Y du graphique utilisateur
                    allChannels = extractChannels(rawApiData, freshChannelNamesMap);

                    // Déterminer les utilisateurs actuellement actifs
                    activeUserChannelMap.clear();
                    if (rawApiData.length > 0) {
                        const lastRecord = rawApiData[rawApiData.length - 1];
                        // Un utilisateur est actif si le dernier enregistrement n'a pas de date de fin
                        if (lastRecord.sessionEnd === null) {
                            lastRecord.channels.forEach(channel => {
                                channel.members.forEach(member => {
                                    activeUserChannelMap.set(member.userId, channel.channelId);
                                });
                            });
                        }
                    }
                    await populateUsersList(users, activeUserChannelMap);

                    // Sélectionner les 10 premiers utilisateurs par défaut
                    const usersListContainer = document.getElementById('usersList');
                    const userCards = usersListContainer.querySelectorAll('.channel-card');
                    selectedUserIds = []; // Reset
                    userCards.forEach((card, index) => {
                        if (index < 10) {
                            const userId = card.dataset.userId;
                            selectedUserIds.push(userId);
                            card.classList.add('selected');
                        }
                    });

                    // Trouver les dates min et max dans les données pour définir la sélection initiale
                    const timestamps = rawApiData.map(d => new Date(d.sessionStart).getTime());
                    const minDate = new Date(Math.min(...timestamps));
                    dashboardMinTs = minDate.getTime();

                    // Générer les annotations pour les graphiques principaux
                    const mainAnnotations = generateAnnotations(minDate, new Date(now));
                    // Applique les annotations sur le principal
                    overviewChart.updateOptions({ annotations: mainAnnotations });

                    // Mettre à jour le graphique brush avec la plage de dates complète
                    overviewChartBrush.updateOptions({
                        xaxis: {
                            min: dashboardMinTs,
                            max: now
                        },
                        annotations: mainAnnotations
                    });

                    // Appliquer la fenêtre par défaut (semaine) sur les deux graphs overview
                    applyOverviewWindow();

                    // Mettre à jour le graphique utilisateur et les stats avec la sélection par défaut
                    if (selectedUserIds.length > 0) {
                        updateUserChartFor(selectedUserIds);
                        updateSelectionUI();
                        await displayUserStats(selectedUserIds);
                    }
                } else {
                    overviewChart.updateOptions({ noData: { text: 'Aucune donnée à afficher pour cette période.' } });
                    document.getElementById('usersList').innerHTML = `<p style="color: var(--text-secondary); padding: 15px;">Aucun utilisateur actif trouvé.</p>`;
                    userChart.updateSeries([]);
                }
            } catch (error) {
                // Afficher une erreur claire si l'API est inaccessible
                const mainContent = document.querySelector('.main-content');
                if (mainContent) {
                    mainContent.innerHTML = `<div class="error" style="margin: 20px;">Erreur critique: Impossible de charger les données du tableau de bord. Veuillez vérifier que l'API est bien démarrée et accessible sur ${API_BASE_URL}, puis rafraîchissez la page.</div>`;
                }
            } finally {
                // Cacher le loader dans tous les cas (succès ou échec)
                hideLoader();
            }
        }

        // --- ÉCOUTEURS D'ÉVÉNEMENTS ---
        // Helpers pour appliquer les fenêtres
        function applyOverviewWindow() {
            if (!dashboardMinTs) return;
            const nowTs = Date.now();
            let winMs;
            if (overviewWindow === '6h') {
                winMs = 6 * 60 * 60 * 1000;
            } else if (overviewWindow === '12h') {
                winMs = 12 * 60 * 60 * 1000;
            } else if (overviewWindow === '24h') {
                winMs = 24 * 60 * 60 * 1000;
            } else if (overviewWindow === 'week') {
                winMs = 7 * 24 * 60 * 60 * 1000;
            } else {
                winMs = 30 * 24 * 60 * 60 * 1000;
            }
            const desiredMin = nowTs - winMs;
            const minTs = Math.max(dashboardMinTs, desiredMin);

            const annotations = generateAnnotations(new Date(minTs), new Date(nowTs));

            // Met à jour le graphique principal (zoom sur la fenêtre)
            overviewChart.updateOptions({
                xaxis: { min: minTs, max: nowTs },
                annotations
            });
            // Met à jour la sélection de la brush pour refléter la fenêtre
            overviewChartBrush.updateOptions({
                chart: {
                    selection: {
                        xaxis: { min: minTs, max: nowTs }
                    }
                }
            });
        }

        function setActive(btnOn, ...btnOffs) {
            if (btnOn) btnOn.classList.add('active');
            btnOffs.forEach(btn => {
                if (btn) btn.classList.remove('active');
            });
        }

        const overview6hBtn = document.getElementById('overview6hBtn');
        const overview12hBtn = document.getElementById('overview12hBtn');
        const overview24hBtn = document.getElementById('overview24hBtn');
        const overviewWeekBtn = document.getElementById('overviewWeekBtn');
        const overviewMonthBtn = document.getElementById('overviewMonthBtn');
        if (overview6hBtn && overview12hBtn && overview24hBtn && overviewWeekBtn && overviewMonthBtn) {
            overview6hBtn.addEventListener('click', () => {
                overviewWindow = '6h';
                setActive(overview6hBtn, overview12hBtn, overview24hBtn, overviewWeekBtn, overviewMonthBtn);
                applyOverviewWindow();
            });
            overview12hBtn.addEventListener('click', () => {
                overviewWindow = '12h';
                setActive(overview12hBtn, overview6hBtn, overview24hBtn, overviewWeekBtn, overviewMonthBtn);
                applyOverviewWindow();
            });
            overview24hBtn.addEventListener('click', () => {
                overviewWindow = '24h';
                setActive(overview24hBtn, overview6hBtn, overview12hBtn, overviewWeekBtn, overviewMonthBtn);
                applyOverviewWindow();
            });
            overviewWeekBtn.addEventListener('click', () => {
                overviewWindow = 'week';
                setActive(overviewWeekBtn, overview6hBtn, overview12hBtn, overview24hBtn, overviewMonthBtn);
                applyOverviewWindow();
            });
            overviewMonthBtn.addEventListener('click', () => {
                overviewWindow = 'month';
                setActive(overviewMonthBtn, overview6hBtn, overview12hBtn, overview24hBtn, overviewWeekBtn);
                applyOverviewWindow();
            });
        }

        const user6hBtn = document.getElementById('user6hBtn');
        const user12hBtn = document.getElementById('user12hBtn');
        const user24hBtn = document.getElementById('user24hBtn');
        const userWeekBtn = document.getElementById('userWeekBtn');
        const userMonthBtn = document.getElementById('userMonthBtn');
        if (user6hBtn && user12hBtn && user24hBtn && userWeekBtn && userMonthBtn) {
            user6hBtn.addEventListener('click', () => {
                userWindow = '6h';
                setActive(user6hBtn, user12hBtn, user24hBtn, userWeekBtn, userMonthBtn);
                updateUserChartFor(selectedUserIds);
                updateSelectionUI();
            });
            user12hBtn.addEventListener('click', () => {
                userWindow = '12h';
                setActive(user12hBtn, user6hBtn, user24hBtn, userWeekBtn, userMonthBtn);
                updateUserChartFor(selectedUserIds);
                updateSelectionUI();
            });
            user24hBtn.addEventListener('click', () => {
                userWindow = '24h';
                setActive(user24hBtn, user6hBtn, user12hBtn, userWeekBtn, userMonthBtn);
                updateUserChartFor(selectedUserIds);
                updateSelectionUI();
            });
            userWeekBtn.addEventListener('click', () => {
                userWindow = 'week';
                setActive(userWeekBtn, user6hBtn, user12hBtn, user24hBtn, userMonthBtn);
                updateUserChartFor(selectedUserIds);
                updateSelectionUI();
            });
            userMonthBtn.addEventListener('click', () => {
                userWindow = 'month';
                setActive(userMonthBtn, user6hBtn, user12hBtn, user24hBtn, userWeekBtn);
                updateUserChartFor(selectedUserIds);
                updateSelectionUI();
            });
        }

        document.getElementById('usersList').addEventListener('click', (e) => {
            const clickedButton = e.target.closest('.channel-card');
            if (clickedButton) {
                const userId = clickedButton.dataset.userId;

                // Gérer la sélection multiple
                clickedButton.classList.toggle('selected');

                const index = selectedUserIds.indexOf(userId);
                if (index > -1) {
                    selectedUserIds.splice(index, 1); // Retirer si déjà sélectionné
                } else {
                    selectedUserIds.push(userId); // Ajouter si non sélectionné
                }

                // Mettre à jour le graphique
                updateUserChartFor(selectedUserIds);
                // Mettre à jour badge + sous-titre
                updateSelectionUI();

                // Mettre à jour la carte de statistiques pour tous les utilisateurs sélectionnés
                if (selectedUserIds.length > 0) {
                    displayUserStats(selectedUserIds);
                } else {
                    displayUserStats(null);
                }
            }
        });

        const refreshStatsBtn = document.getElementById('refreshStatsBtn');
        if (refreshStatsBtn) {
            refreshStatsBtn.addEventListener('click', async () => {
                const icon = refreshStatsBtn.querySelector('i');
                const textSpan = refreshStatsBtn.querySelector('span');
                const originalText = textSpan.textContent;

                // Disable button and show loading state
                refreshStatsBtn.disabled = true;
                icon.classList.add('fa-spin');
                textSpan.textContent = 'Mise à jour...';

                try {
                    // This endpoint should be routed to userStatsController.updateAllUserStats
                    const response = await makeFetchRequest(`${API_BASE_URL}/dashboard/guilds/${GUILD_ID}/stats/update`, {
                        method: 'POST'
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ message: `La mise à jour a échoué (statut ${response.status})` }));
                        throw new Error(errorData.message);
                    }

                    const result = await response.json();
                    alert(result.message); // Simple feedback for the user

                    // If users are selected, refresh their stats view to show the new data
                    if (selectedUserIds.length > 0) {
                        await displayUserStats(selectedUserIds);
                    }
                } catch (error) {
                    console.error('Erreur lors du rafraîchissement des statistiques:', error);
                    alert(`Erreur: ${error.message}`); // Simple feedback
                } finally {
                    // Re-enable button and restore original state
                    refreshStatsBtn.disabled = false;
                    icon.classList.remove('fa-spin');
                    textSpan.textContent = originalText;
                }
            });
        }

        // Lancer l'initialisation au chargement de la page
        document.addEventListener('DOMContentLoaded', initializeDashboard);
    // Initialiser affichage du badge (0 sélection) et sous-titre
    document.addEventListener('DOMContentLoaded', () => updateSelectionUI());