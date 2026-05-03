document.addEventListener('DOMContentLoaded', () => {
    let recentTrackIds = [];
    let top100Data = [];
    let currentTopPage = 0; // 0-based, 10 songs per page → 10 pages total
    let chartCountryCode = 'us'; // default: global (US)
    


    const form = document.getElementById('curatorForm');

    const moodInput = document.getElementById('moodInput');
    const weatherInput = document.getElementById('weatherInput');
    const genreInput = document.getElementById('genreInput');
    
    const submitBtn = form.querySelector('.primary-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.spinner');
    
    const resultSection = document.getElementById('resultSection');
    const themeTitle = document.getElementById('themeTitle');
    const playlistContainer = document.getElementById('playlistContainer');
    const tipContent = document.getElementById('tipContent');

    // Settings Modal Elements
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const preferredGenreInput = document.getElementById('preferredGenreInput');
    const autoWeatherToggle = document.getElementById('autoWeatherToggle');
    const weatherInputGroup = document.getElementById('weatherInputGroup');

    let isAutoWeather = localStorage.getItem('auto_weather') === 'true';
    if(isAutoWeather) {
        if(autoWeatherToggle) autoWeatherToggle.checked = true;
        if(weatherInputGroup) weatherInputGroup.classList.add('hidden');
    }

    if(autoWeatherToggle) {
        autoWeatherToggle.addEventListener('change', async (e) => {
            isAutoWeather = e.target.checked;
            localStorage.setItem('auto_weather', isAutoWeather);
            if(isAutoWeather) {
                weatherInputGroup.classList.add('hidden');
                const { cc, name } = await getCountryCode();
                chartCountryCode = cc;
                loadTop100(cc);
                top100Title.textContent    = `📍 ${name} TOP 100`;
                top100Subtitle.textContent = `${name} 인기 차트`;
            } else {
                weatherInputGroup.classList.remove('hidden');
                chartCountryCode = 'us';
                loadTop100('us');
                top100Title.textContent    = '🌏 글로벌 TOP 100';
                top100Subtitle.textContent = '전 세계 인기 차트';
            }
        });
    }

    const savedPreferredGenre = localStorage.getItem('preferred_genre');
    if(savedPreferredGenre && preferredGenreInput) preferredGenreInput.value = savedPreferredGenre;

    // Theme Setup
    const themeToggle = document.getElementById('themeToggle');
    let currentTheme = localStorage.getItem('theme') || 'dark';
    
    // Checked state means Dark Mode now
    if (currentTheme === 'dark') {
        document.body.classList.remove('light-mode');
        themeToggle.checked = true;
    } else {
        document.body.classList.add('light-mode');
        themeToggle.checked = false;
    }

    themeToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.body.classList.remove('light-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.add('light-mode');
            localStorage.setItem('theme', 'light');
        }
    });

    // ─── TOP 100 Chart ─────────────────────────────────────────
    const top100ListEl   = document.getElementById('top100List');
    const top100Loading  = document.getElementById('top100Loading');
    const top100Title    = document.getElementById('top100Title');
    const top100Subtitle = document.getElementById('top100Subtitle');
    const top100PageInfo = document.getElementById('top100PageInfo');
    const top100Prev     = document.getElementById('top100Prev');
    const top100Next     = document.getElementById('top100Next');

    // ── 국가 코드 감지 함수 (Cloudflare CDN trace 우선 사용) ─────────
    async function getCountryCode() {
        // 국가 코드 → 한국어 국가명 매핑 (주요 50개국)
        const countryNames = {
            kr: '대한민국', us: '미국', jp: '일본', gb: '영국', de: '독일',
            fr: '프랑스', au: '호주', ca: '캐나다', cn: '중국', ru: '러시아',
            br: '브라질', in: '인도', mx: '멕시코', it: '이탈리아', es: '스페인',
            nl: '네덜란드', se: '스웨덴', no: '노르웨이', dk: '덴마크', fi: '핀란드',
            sg: '싱가포르', tw: '대만', hk: '홍콩', th: '태국', ph: '필리핀',
            id: '인도네시아', my: '말레이시아', nz: '뉴질랜드', za: '남아프리카',
            ar: '아르헨티나', cl: '칠레', co: '콜롬비아', pt: '포르투갈',
            pl: '폴란드', cz: '체코', at: '오스트리아', ch: '스위스', be: '벨기에',
            tr: '터키', sa: '사우디아라비아', ae: '아랍에미리트', eg: '이집트',
            ng: '나이지리아', ke: '케냐', ua: '우크라이나', hu: '헝가리',
            ro: '루마니아', sk: '슬로바키아', gr: '그리스', il: '이스라엘'
        };

        // ① Cloudflare CDN-CGI Trace — IP 기반 서비스 중 가장 정확
        //    Cloudflare는 전 세계 300+ 엣지 서버에서 실제 접속 위치를 반환
        try {
            const r = await fetch('https://www.cloudflare.com/cdn-cgi/trace', { mode: 'cors' });
            if (r.ok) {
                const text = await r.text();
                const m = text.match(/^loc=([A-Z]{2})/m);
                if (m?.[1]) {
                    const cc = m[1].toLowerCase();
                    console.log('[Location] Cloudflare trace 성공:', cc);
                    return { cc, name: countryNames[cc] || cc.toUpperCase() };
                }
            }
        } catch (e) { console.warn('[Location] Cloudflare trace 실패:', e.message); }

        // ② 브라우저 GPS → Nominatim 역지오코딩 (허가된 경우 가장 정확)
        if (navigator.geolocation) {
            try {
                const pos = await new Promise((resolve, reject) =>
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        timeout: 7000, maximumAge: 0, enableHighAccuracy: false
                    })
                );
                const { latitude, longitude } = pos.coords;
                console.log('[Location] GPS 좌표:', latitude, longitude);
                const geoRes = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=3`,
                    { headers: { 'Accept-Language': 'ko,en' } }
                );
                if (geoRes.ok) {
                    const geoData = await geoRes.json();
                    const cc = geoData.address?.country_code?.toLowerCase();
                    if (cc) {
                        const name = countryNames[cc] || geoData.address?.country || cc.toUpperCase();
                        console.log('[Location] Nominatim 성공:', cc, name);
                        return { cc, name };
                    }
                }
            } catch (e) { console.warn('[Location] GPS/Nominatim 실패:', e.message); }
        }

        // ③ get.geojs.io — 단순 국가 코드만 반환, CORS OK, HTTPS
        try {
            const r = await fetch('https://get.geojs.io/v1/ip/country.json');
            if (r.ok) {
                const d = await r.json();
                if (d.country) {
                    const cc = d.country.toLowerCase();
                    console.log('[Location] GeoJS 성공:', cc);
                    return { cc, name: countryNames[cc] || d.name || cc.toUpperCase() };
                }
            }
        } catch (e) { console.warn('[Location] GeoJS 실패:', e.message); }

        // ④ ipapi.co — 상세 정보, HTTPS
        try {
            const r = await fetch('https://ipapi.co/json/');
            if (r.ok) {
                const d = await r.json();
                if (d.country_code && !['undefined', 'null'].includes(d.country_code)) {
                    const cc = d.country_code.toLowerCase();
                    console.log('[Location] ipapi.co 성공:', cc);
                    return { cc, name: countryNames[cc] || d.country_name || cc.toUpperCase() };
                }
            }
        } catch (e) { console.warn('[Location] ipapi.co 실패:', e.message); }

        console.warn('[Location] 모든 방법 실패, 기본값 사용');
        return { cc: 'us', name: '글로벌' };
    }




    function renderTop100Page(page) {
        currentTopPage = page;
        const start = page * 10;
        const slice = top100Data.slice(start, start + 10);
        const totalPages = Math.ceil(top100Data.length / 10);

        top100ListEl.innerHTML = '';
        slice.forEach((song, i) => {
            const rank = start + i + 1;
            let rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';

            const li = document.createElement('li');
            li.className = 'top100-item' + (song.previewUrl ? ' chart-playable' : '');
            li.innerHTML = `
                <span class="top100-rank ${rankClass}">${rank}</span>
                <div class="top100-art-wrap">
                    <img class="top100-art" src="${song.art}" alt="${song.title}" loading="lazy">
                    ${song.previewUrl ? `<div class="top100-play-overlay">
                        <svg class="play-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        <svg class="pause-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                    </div>` : ''}
                </div>
                <div class="top100-info">
                    <div class="top100-song-title">${song.title}</div>
                    <div class="top100-song-artist">${song.artist}</div>
                </div>
            `;

            if (song.previewUrl) {
                li.addEventListener('click', () => togglePlay(song.previewUrl, li));
            }
            top100ListEl.appendChild(li);
        });

        top100PageInfo.textContent = `${page + 1} / ${totalPages}`;
        top100Prev.disabled = (page === 0);
        top100Next.disabled = (page >= totalPages - 1);
    }

    async function loadTop100(countryCode) {
        top100Loading.classList.remove('hidden');
        top100ListEl.innerHTML = '';
        top100Data = [];

        async function fetchPreviews(idList) {
            const map = {};
            const chunks = [];
            for (let i = 0; i < idList.length; i += 50) chunks.push(idList.slice(i, i + 50));
            for (const chunk of chunks) {
                try {
                    const r = await fetch(`https://itunes.apple.com/lookup?id=${chunk.join(',')}&country=${countryCode}&entity=song`);
                    const d = await r.json();
                    (d.results || []).forEach(t => { if (t.previewUrl) map[String(t.trackId)] = t.previewUrl; });
                } catch (_) {}
            }
            return map;
        }

        async function tryFetch(url) {
            // 1. Direct
            try {
                const r = await fetch(url);
                if (r.ok) return await r.json();
            } catch(e) {}
            // 2. Proxy (corsproxy.io)
            try {
                const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
                if (r.ok) return await r.json();
            } catch(e) {}
            // 3. Proxy (allorigins)
            try {
                const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
                const d = await r.json();
                return JSON.parse(d.contents);
            } catch(e) {}
            return null;
        }

        try {
            // US(Global)은 RSS가 가장 안정적, 그 외는 Marketing API 시도
            const targetUrl = (countryCode === 'us') 
                ? `https://itunes.apple.com/us/rss/topsongs/limit=100/json`
                : `https://rss.applemarketingtools.com/api/v2/${countryCode}/music/top-songs/100/songs.json`;
                
            const json = await tryFetch(targetUrl);
            let items = [];

            if (json?.feed?.entry) { // RSS format
                items = json.feed.entry.map(e => ({
                    id:         e.id?.attributes?.['im:id'],
                    name:       e['im:name']?.label,
                    artistName: e['im:artist']?.label,
                    artworkUrl100: e['im:image']?.[2]?.label,
                    previewUrl: null
                }));
            } else if (json?.feed?.results) { // Marketing API format
                items = json.feed.results;
            }

            // Fallback for Korea
            if (items.length < 20 && countryCode === 'kr') {
                const sRes = await fetch(`https://itunes.apple.com/search?term=K-Pop&country=kr&entity=song&limit=100`);
                const sData = await sRes.json();
                items = (sData.results || []).map(s => ({
                    id: s.trackId,
                    name: s.trackName,
                    artistName: s.artistName,
                    artworkUrl100: s.artworkUrl100,
                    previewUrl: s.previewUrl
                }));
            }

            if (!items || items.length === 0) throw new Error('No data');

            top100Data = items.map(item => ({
                id:         item.id,
                title:      item.name       || '알 수 없음',
                artist:     item.artistName || '',
                art:        (item.artworkUrl100 || '').replace(/\d+x\d+bb/, '120x120bb'),
                previewUrl: item.previewUrl || null
            }));

            renderTop100Page(0);
            top100Loading.classList.add('hidden');

            const missingIds = top100Data.filter(d => !d.previewUrl).map(d => d.id).filter(Boolean);
            if (missingIds.length > 0) {
                const previewMap = await fetchPreviews(missingIds);
                top100Data.forEach(d => { if (previewMap[d.id]) d.previewUrl = previewMap[d.id]; });
                renderTop100Page(currentTopPage);
            }
        } catch (err) {
            top100ListEl.innerHTML = '<li class="top100-error">차트 데이터를 불러오는 데 실패했습니다.</li>';
        } finally {
            top100Loading.classList.add('hidden');
        }
    }


    top100Prev.addEventListener('click', () => {
        if (currentTopPage > 0) renderTop100Page(currentTopPage - 1);
    });
    top100Next.addEventListener('click', () => {
        const totalPages = Math.ceil(top100Data.length / 10);
        if (currentTopPage < totalPages - 1) renderTop100Page(currentTopPage + 1);
    });

    // Initial chart load (global / US)
    loadTop100('us');
    top100Title.textContent    = '🌏 글로벌 TOP 100';
    top100Subtitle.textContent = '전 세계 인기 차트';



    // Modal Events
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });

    const closeModal = () => {
        settingsModal.classList.add('hidden');
    };

    closeModalBtn.addEventListener('click', closeModal);
    
    settingsModal.addEventListener('click', (e) => {
        if(e.target === settingsModal) closeModal();
    });

    saveSettingsBtn.addEventListener('click', () => {
        if(preferredGenreInput) {
            const preferredGenre = preferredGenreInput.value.trim();
            if(preferredGenre) {
                localStorage.setItem('preferred_genre', preferredGenre);
            } else {
                localStorage.removeItem('preferred_genre');
            }
        }
        
        closeModal();
    });

    // Form Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 새로운 추천 요청 시 기존 음악 정지
        if (currentAudio) {
            currentAudio.pause();
            if (playingCard) playingCard.classList.remove('playing');
        }
        
        let mood = moodInput.value.trim();
        let weather = weatherInput.value.trim();
        const genre = genreInput.value.trim();

        setLoading(true);

        try {
            if (isAutoWeather) {
                // 사용자의 위치 정보를 받아와 날씨 API 호출 (Open-Meteo 사용)
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                }).catch(() => null);

                if (position) {
                    const { latitude, longitude } = position.coords;
                    try {
                        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
                        const weatherData = await weatherRes.json();
                        const code = weatherData.current_weather.weathercode;
                        
                        // WMO Weather interpretation codes 매핑
                        if (code <= 3) weather = '화창한';
                        else if (code <= 48) weather = '흐린';
                        else if (code <= 67) weather = '비오는';
                        else if (code <= 77) weather = '눈오는';
                        else if (code <= 82) weather = '비오는';
                        else if (code <= 86) weather = '눈오는';
                        else if (code <= 99) weather = '폭우';
                        else weather = '맑음';
                    } catch(err) {
                        weather = '맑음'; // API 오류 시 기본값
                    }
                } else {
                    weather = '맑음'; // 권한 거부 시 기본값
                }
            }

            if(!mood && !weather && !genre) {
                alert('기분, 날씨, 장르 중 최소 하나는 입력해 주셔야 맞춤형 추천이 가능합니다!');
                setLoading(false);
                return;
            }

            const data = await getPlaylistRecommendation(mood, weather, genre);
            
            // Fetch album covers for the playlist
            for (let i = 0; i < data.playlist.length; i++) {
                const song = data.playlist[i];
                if (!song.artwork) {
                    song.artwork = await fetchAlbumCover(song.artist, song.title);
                }
            }
            
            renderPlaylist(data);
        } catch (error) {
            console.error('Error fetching playlist:', error);
            alert('플레이리스트를 가져오는 중 오류가 발생했습니다. 나중에 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    });

    function setLoading(isLoading) {
        if(isLoading) {
            btnText.classList.add('hidden');
            spinner.classList.remove('hidden');
            submitBtn.disabled = true;
            resultSection.classList.add('hidden');
        } else {
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
            submitBtn.disabled = false;
        }
    }

    async function getPlaylistRecommendation(mood, weather, genre) {
        // AI가 생각하는 듯한 효과를 주기 위한 짧은 딜레이
        await new Promise(resolve => setTimeout(resolve, 1500));
        return getMockData(mood, weather, genre);
    }

    async function fetchAlbumCover(artist, title) {
        try {
            const term = encodeURIComponent(`${artist} ${title}`);
            const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=1`);
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                return {
                    artwork: data.results[0].artworkUrl100.replace('100x100', '300x300'),
                    previewUrl: data.results[0].previewUrl
                };
            }
        } catch(e) {
            console.error('Artwork fetch error:', e);
        }
        // Fallback placeholder
        return 'https://via.placeholder.com/150/1e1e1e/ffffff?text=No+Cover';
    }

    async function getMockData(mood, weather, genre) {
        try {
            // 1. Mood Analysis
            let moodType = 'neutral';
            let moodSearchKeyword = '';
            const moodLower = (mood || '').toLowerCase();
            if (moodLower.match(/신나|기뻐|기쁨|행복|즐거|설레|밝/)) {
                moodType = 'positive';
                const moodKeys = ['dance', 'upbeat', 'party', 'happy pop'];
                moodSearchKeyword = moodKeys[Math.floor(Math.random() * moodKeys.length)];
            } else if (moodLower.match(/우울|슬퍼|슬픔|울고|외로|눈물/)) {
                moodType = 'negative';
                const moodKeys = ['sad ballad', 'acoustic', 'lo-fi', 'melancholy'];
                moodSearchKeyword = moodKeys[Math.floor(Math.random() * moodKeys.length)];
            } else if (moodLower.match(/화나|분노|답답|짜증|스트레스/)) {
                moodType = 'angry';
                const moodKeys = ['rock', 'hard rock', 'metal', 'heavy'];
                moodSearchKeyword = moodKeys[Math.floor(Math.random() * moodKeys.length)];
            } else if (moodLower.match(/차분|조용|잔잔|집중|공부|편안|휴식|수면/)) {
                moodType = 'calm';
                const moodKeys = ['chill', 'ambient', 'piano', 'healing lofi'];
                moodSearchKeyword = moodKeys[Math.floor(Math.random() * moodKeys.length)];
            }

            // 2. Weather Analysis
            let weatherType = 'neutral';
            let weatherSearchKeyword = '';
            const weatherLower = (weather || '').toLowerCase();
            if (weatherLower.match(/화창|맑음|해|햇빛|좋은|따뜻/)) {
                weatherType = 'good';
                const weatherKeys = ['sunny pop', 'breezy acoustic', 'bright indie'];
                weatherSearchKeyword = weatherKeys[Math.floor(Math.random() * weatherKeys.length)];
            } else if (weatherLower.match(/비|장마|소나기|흐림|우중충/)) {
                weatherType = 'bad_rain';
                const weatherKeys = ['rainy acoustic', 'jazz ballad', 'gloomy lofi'];
                weatherSearchKeyword = weatherKeys[Math.floor(Math.random() * weatherKeys.length)];
            } else if (weatherLower.match(/눈|겨울|추운/)) {
                weatherType = 'bad_snow';
                const weatherKeys = ['winter acoustic', 'snowy jazz', 'holiday pop'];
                weatherSearchKeyword = weatherKeys[Math.floor(Math.random() * weatherKeys.length)];
            }

            // 3. Contradiction Check
            let isContradictory = false;
            if ((moodType === 'positive' && (weatherType === 'bad_rain' || weatherType === 'bad_snow')) || 
                ((moodType === 'negative' || moodType === 'angry') && weatherType === 'good')) {
                isContradictory = true;
            }

            // 4. Base Genre Mapping (확장된 매핑)
            let baseGenre = genre || localStorage.getItem('preferred_genre') || 'music';
            let genreSearchKeyword = baseGenre;
            const genreLower = baseGenre.toLowerCase().trim();
            
            const genreMap = {
                // K-Pop & Korean
                '아이돌': 'k-pop', '케이팝': 'k-pop', 'kpop': 'k-pop', 'k-pop': 'k-pop',
                '국내 힙합': 'k-hiphop', '국내 랩': 'k-hiphop', '국 힙': 'k-hiphop',
                '국내 인디': 'k-indie', '국내 밴드': 'k-indie',
                '발라드': 'ballad', 'k-ballad': 'ballad',
                '트로트': 'trot', '성인가요': 'trot',
                '시티팝': 'city pop', '국내 시티팝': 'korean city pop',

                // Pop
                '팝': 'pop', '댄스': 'dance', '신스팝': 'synthpop', '일렉트로팝': 'electropop',
                '드림팝': 'dream pop', '인디팝': 'indie pop', '틴팝': 'teen pop',

                // Rock
                '락': 'rock', '록': 'rock', '밴드': 'band', '모던락': 'modern rock',
                '인디락': 'indie rock', '얼터너티브': 'alternative rock', '펑크': 'punk rock',
                '메탈': 'metal', '헤비메탈': 'heavy metal', '하드락': 'hard rock',
                '슈게이징': 'shoegaze', '포스트락': 'post-rock', '그란지': 'grunge',
                '브릿팝': 'britpop', '사이키델릭': 'psychedelic rock', '개러지락': 'garage rock',
                '데스메탈': 'death metal', '블랙메탈': 'black metal', '프로그레시브': 'progressive rock',

                // Electronic / EDM
                '일렉트로닉': 'electronic', '일렉': 'electronic', 'edm': 'edm',
                '테크노': 'techno', '하우스': 'house', '트랜스': 'trance',
                '덥스텝': 'dubstep', '드럼앤베이스': 'drum and bass', 'dnb': 'drum and bass',
                '딥하우스': 'deep house', '트로피컬 하우스': 'tropical house',
                '퓨처베이스': 'future bass', '하드스타일': 'hardstyle', '유로댄스': 'eurodance',
                '엠비언트': 'ambient', '다운템포': 'downtempo', 'idm': 'idm',
                '베이퍼웨이브': 'vaporwave', '시티팝': 'city pop',

                // Hip Hop / R&B
                '힙합': 'hiphop', '랩': 'rap', '붐뱁': 'boom bap', '트랩': 'trap',
                '드릴': 'drill', '지펑크': 'g-funk', '올드스쿨': 'old school',
                '알앤비': 'r&b', '소울': 'soul', '네오소울': 'neo soul',
                '컨템포러리 알앤비': 'contemporary r&b', '모타운': 'motown',
                '펑크(음악)': 'funk', '디스코': 'disco', '가스펠': 'gospel',

                // Jazz / Blues
                '재즈': 'jazz', '비밥': 'bebop', '쿨재즈': 'cool jazz', '퓨전재즈': 'fusion jazz',
                '애시드재즈': 'acid jazz', '보사노바': 'bossa nova', '스윙': 'swing',
                '스무스재즈': 'smooth jazz', '프리재즈': 'free jazz', '보컬재즈': 'vocal jazz',
                '블루스': 'blues', '리듬앤블루스': 'r&b',

                // Classical
                '클래식': 'classical', '바로크': 'baroque', '낭만주의': 'romantic',
                '현대음악': 'modern classical', '미니멀리즘': 'minimalism',
                '오페라': 'opera', '실내악': 'chamber music', '합창': 'choral',
                '뉴에이지': 'new age',

                // Folk / Country
                '포크': 'folk', '컨트리': 'country', '블루그래스': 'bluegrass',
                '아메리카나': 'americana', '어쿠스틱': 'acoustic',
                '싱어송라이터': 'singer songwriter',

                // World / Others
                '제이팝': 'j-pop', 'jpop': 'j-pop', '시티팝': 'city pop',
                '라틴': 'latin', '레게': 'reggae', '스카': 'ska',
                '플라멩코': 'flamenco', '아프로비트': 'afrobeat',
                '살사': 'salsa', '레게톤': 'reggaeton',
                '뮤지컬': 'musical', 'ost': 'soundtrack', '영화음악': 'soundtrack',

                // Mood / Special
                '로파이': 'lo-fi', 'lofi': 'lo-fi', '로파이 힙합': 'lo-fi hiphop',
                '칠': 'chill', '칠아웃': 'chillout', '명상': 'meditation',
                '수면': 'sleep', '운동': 'workout', '집중': 'focus',
                '게임': 'gaming', '크리스마스': 'christmas', '캐롤': 'carol'
            };
            
            // 한글 -> 영어 매핑 및 한국 지역성 강화
            let isKpopTarget = false;
            if (genreMap[genreLower]) {
                genreSearchKeyword = genreMap[genreLower];
                if (['아이돌', '발라드', '트로트', '인디'].includes(genreLower)) isKpopTarget = true;
            } else if (genreLower.match(/한국|국내|k-|케이/)) {
                isKpopTarget = true;
                if (genreLower.match(/밴드|인디/)) genreSearchKeyword = 'k-indie';
                else if (genreLower.match(/힙합|랩/)) genreSearchKeyword = 'k-hiphop';
                else if (genreLower.match(/발라드/)) genreSearchKeyword = 'k-ballad';
                else genreSearchKeyword = 'k-pop';
            } else {
                let translated = genreLower;
                for (const [ko, en] of Object.entries(genreMap)) {
                    translated = translated.replace(new RegExp(ko, 'g'), en);
                }
                genreSearchKeyword = translated.trim();
            }

            // 5. Fetch Logic (더 많은 데이터 가져와서 필터링)
            const fetches = [];
            let usingSplit = false;
            let splitReason = ''; 
            const prefGenre = localStorage.getItem('preferred_genre');
            
            // 국가 코드 설정 (한국 장르나 키워드 포함 시 KR 우선)
            const country = isKpopTarget ? 'KR' : 'US';

            if (isContradictory) {
                usingSplit = true;
                splitReason = 'contradiction';
                const term1 = encodeURIComponent(`${genreSearchKeyword} ${moodSearchKeyword}`);
                fetches.push(fetch(`https://itunes.apple.com/search?term=${term1}&entity=song&limit=100&country=${country}`).then(r => r.json()));
                const term2 = encodeURIComponent(`${genreSearchKeyword} ${weatherSearchKeyword}`);
                fetches.push(fetch(`https://itunes.apple.com/search?term=${term2}&entity=song&limit=100&country=${country}`).then(r => r.json()));
            } else if (!genre && prefGenre) {
                usingSplit = true;
                splitReason = 'preferred';
                const contextTerm = encodeURIComponent(`${moodSearchKeyword} ${weatherSearchKeyword}`.trim() || 'hits');
                fetches.push(fetch(`https://itunes.apple.com/search?term=${contextTerm}&entity=song&limit=100&country=${country}`).then(r => r.json()));
                const prefTerm = encodeURIComponent(`${prefGenre} ${moodSearchKeyword}`);
                fetches.push(fetch(`https://itunes.apple.com/search?term=${prefTerm}&entity=song&limit=100&country=${country}`).then(r => r.json()));
            } else {
                const combined = [genreSearchKeyword, moodSearchKeyword, weatherSearchKeyword].filter(Boolean).join(' ');
                const term = encodeURIComponent(combined);
                fetches.push(fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=200&country=${country}`).then(r => r.json()));
            }
            
            const results = await Promise.all(fetches);
            const mainData = results[0];
            const secondaryData = results.length > 1 ? results[1] : null;
            
            // 6. 점수 기반 필터링 알고리즘 (Scoring Algorithm)
            const isKoreanArtist = (s) => /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(s.artistName);
            
            const scoreSong = (s) => {
                let score = 0;
                const trackName = (s.trackName || '').toLowerCase();
                const artistName = (s.artistName || '').toLowerCase();
                const itunesGenre = (s.primaryGenreName || '').toLowerCase();
                const fullText = `${trackName} ${artistName} ${itunesGenre}`;

                // 1. 장르 일치성 (가장 중요)
                if (genreSearchKeyword) {
                    const kw = genreSearchKeyword.toLowerCase();
                    if (fullText.includes(kw)) score += 20;
                    if (itunesGenre.includes(kw)) score += 15;
                }

                // 2. 한국 아티스트 우선순위 (한국 관련 요청 시)
                if (isKpopTarget) {
                    if (isKoreanArtist(s)) score += 30;
                    else score -= 50; // 외국 곡은 강력하게 배제
                }

                // 3. 기분/날씨 키워드
                if (moodSearchKeyword && fullText.includes(moodSearchKeyword.toLowerCase())) score += 5;
                if (weatherSearchKeyword && fullText.includes(weatherSearchKeyword.toLowerCase())) score += 3;

                // 4. 장르 불일치 페널티 (예: 밴드 요청했는데 힙합이 나오는 경우)
                if (genreLower.includes('밴드') || genreLower.includes('락')) {
                    if (itunesGenre.includes('hip-hop') || itunesGenre.includes('rap')) score -= 100;
                }
                if (genreLower.includes('힙합') || genreLower.includes('랩')) {
                    if (itunesGenre.includes('rock') || itunesGenre.includes('band')) score -= 100;
                }

                return score;
            };

            const filterAndSort = (arr) => {
                return arr
                    .map(s => ({ ...s, relevanceScore: scoreSong(s) }))
                    .filter(s => !recentTrackIds.includes(s.trackId))
                    .filter(s => s.relevanceScore > -20) // 최소 점수 미달은 필터링
                    .sort((a, b) => b.relevanceScore - a.relevanceScore);
            };

            if (usingSplit && secondaryData && secondaryData.results && secondaryData.results.length > 0) {
                const firstSorted = filterAndSort(mainData.results || []);
                const secondSorted = filterAndSort(secondaryData.results);
                
                const firstSongs = firstSorted.slice(0, 2).map(song => ({ ...song, sourceContext: splitReason === 'contradiction' ? 'mood' : 'context' }));
                const secondSongs = secondSorted.slice(0, 2).map(song => ({ ...song, sourceContext: splitReason === 'contradiction' ? 'weather' : 'preferred' }));
                
                selectedSongs = [...firstSongs, ...secondSongs];
                if (selectedSongs.length < 4) {
                    const fallback = firstSorted.slice(2, 6 - selectedSongs.length);
                    selectedSongs = [...selectedSongs, ...fallback.map(s => ({...s, sourceContext: 'fallback'}))];
                }
                selectedSongs.sort(() => 0.5 - Math.random());
            } else if (mainData.results && mainData.results.length > 0) {
                const sorted = filterAndSort(mainData.results);
                selectedSongs = sorted.slice(0, 4);
            }

            // 검색 결과가 4곡 미만일 경우 부족한 만큼 포괄적인 검색어(genreSearchKeyword 또는 'pop')로 추가 검색하여 채움
            if (selectedSongs.length > 0 && selectedSongs.length < 4) {
                try {
                    const fallbackTerm = encodeURIComponent(genreSearchKeyword || 'pop');
                    const fallbackData = await fetch(`https://itunes.apple.com/search?term=${fallbackTerm}&entity=song&limit=50&country=KR`).then(r => r.json());
                    if (fallbackData.results && fallbackData.results.length > 0) {
                        const fallbackShuffled = fallbackData.results.sort(() => 0.5 - Math.random());
                        const existingTrackIds = new Set(selectedSongs.map(s => s.trackId));
                        const extraSongs = fallbackShuffled.filter(s => !existingTrackIds.has(s.trackId)).slice(0, 4 - selectedSongs.length);
                        selectedSongs = [...selectedSongs, ...extraSongs.map(s => ({...s, sourceContext: 'fallback'}))];
                    }
                } catch (e) {
                    console.error('Fallback padding failed', e);
                }
            }

            // 최근 추천 목록 업데이트 (최대 8개 유지 = 최근 2번의 4곡 추천)
            if (selectedSongs.length > 0) {
                const newIds = selectedSongs.map(s => s.trackId);
                recentTrackIds = [...recentTrackIds, ...newIds].slice(-8);
                
                const displayWeather = weather || '오늘';
                const displayMood = mood || '당신의';
                const displayGenre = genre || (splitReason === 'preferred' ? prefGenre : '음악');

                const adjectives = ['감각적인', '매력적인', '독보적인', '트렌디한', '감성적인', '아름다운', '리드미컬한', '인상적인', '세련된', '환상적인', '독특한', '풍성한'];
                const shuffledAdjectives = adjectives.sort(() => 0.5 - Math.random());
                const usedTemplates = {};

                const playlist = selectedSongs.map((song, idx) => {
                    // iTunes 장르명을 한국어로 친숙하게 변환
                    const itunesGenre = song.primaryGenreName || '';
                    const genreTranslate = {
                        'K-Pop': 'K-Pop', 'Dance': '댄스', 'Pop': '팝', 
                        'R&B/Soul': 'R&B/소울', 'Hip-Hop/Rap': '힙합',
                        'Rock': '락', 'Alternative': '얼터너티브',
                        'Singer/Songwriter': '싱어송라이터', 'Acoustic': '어쿠스틱',
                        'Ballad': '발라드', 'Jazz': '재즈', 'Classical': '클래식',
                        'Electronic': '일렉트로닉', 'New Age': '뉴에이지',
                        'J-Pop': 'J-Pop', 'World': '월드 뮤직'
                    };
                    const trackGenre = genreTranslate[itunesGenre] || itunesGenre || displayGenre;
                    const adj = shuffledAdjectives[idx % shuffledAdjectives.length];
                    
                    let reasonText = '';
                    let templates = [];
                    
                    if (song.sourceContext === 'mood') {
                        templates = [
                            `현재 날씨(${displayWeather})와는 상반되지만, 당신의 '${displayMood}' 기분을 완벽하게 표현해 줄 ${adj} ${trackGenre} 곡입니다.`,
                            `밖은 ${displayWeather} 날씨지만, 당신이 느끼는 '${displayMood}' 감정에 온전히 집중할 수 있도록 고른 ${trackGenre} 트랙입니다.`,
                            `날씨(${displayWeather})의 영향에서 벗어나, 오직 '${displayMood}' 기분에만 귀 기울일 수 있는 ${adj} ${trackGenre} 음악입니다.`
                        ];
                    } else if (song.sourceContext === 'weather') {
                        templates = [
                            `지금의 '${displayMood}' 기분과는 분위기가 사뭇 다르지만, 창밖의 '${displayWeather}' 풍경에 너무나 잘 어울리는 ${trackGenre} 트랙입니다.`,
                            `당신의 '${displayMood}' 감정에서 잠시 벗어나, 현재의 '${displayWeather}' 날씨를 만끽하게 해줄 ${adj} ${trackGenre} 곡입니다.`,
                            `기분('${displayMood}')보다는 오늘의 날씨('${displayWeather}')에 초점을 맞추어 특별히 선곡된 ${trackGenre} 음악입니다.`
                        ];
                    } else if (song.sourceContext === 'preferred') {
                        templates = [
                            `입력창을 비워두셨지만, 설정해두신 선호 장르인 ${prefGenre} 취향을 반영하여 특별히 선곡한 ${adj} ${trackGenre} 곡입니다.`,
                            `당신이 평소 좋아하는 ${prefGenre} 스타일을 잊지 않고 챙겼습니다. ${adj} ${trackGenre} 사운드를 즐겨보세요.`,
                            `장르를 지정하지 않으셨기에, 당신의 최애 장르인 ${prefGenre} 중에서 가장 돋보이는 ${trackGenre} 트랙을 하나 골라봤습니다.`
                        ];
                    } else if (song.sourceContext === 'context') {
                        templates = [
                            `요청하신 '${displayMood}' 기분과 '${displayWeather}' 날씨에 부드럽게 스며드는 ${adj} ${trackGenre} 트랙입니다.`,
                            `${adj} ${trackGenre} 사운드가 '${displayWeather}'의 분위기를 살려주며, 당신의 '${displayMood}' 기분과 완벽한 시너지를 만듭니다.`,
                            `지금 느끼시는 '${displayMood}' 감정을 더욱 깊게 만들어줄 곡으로, '${displayWeather}'에 듣기 딱 좋은 ${trackGenre} 음악입니다.`,
                            `이 ${trackGenre} 곡의 ${adj} 흐름이 '${displayWeather}'의 주변 공기를 바꿔주며, '${displayMood}' 기분 전환에 도움을 줄 것입니다.`
                        ];
                    } else {
                        templates = [
                            `${trackGenre} 특유의 리듬이 ${displayMood} 기분을 한층 살려주며, ${displayWeather}의 풍경과도 완벽한 조화를 이룹니다.`,
                            `${trackGenre} 장르에 아티스트의 감성이 잘 녹아들어 있어, 듣는 순간 지금의 감정 상태에 흠뻑 빠져들 수 있습니다.`,
                            `이 ${trackGenre} 트랙은 요청하신 감성을 가장 잘 보여줍니다. 곡의 ${adj} 흐름이 분위기를 완전히 전환해 줍니다.`,
                            `마치 영화의 한 장면처럼 드라마틱한 ${trackGenre} 선율이 돋보여, 현재 계신 곳을 더욱 멋진 공간으로 만들어 줍니다.`,
                            `당신의 '${displayMood}' 기분에 깊이 공감하며, ${displayWeather} 날씨에 들으면 더욱 매력적인 ${trackGenre} 곡입니다.`
                        ];
                    }

                    if (!usedTemplates[song.sourceContext]) {
                        usedTemplates[song.sourceContext] = templates.map((_, i) => i).sort(() => 0.5 - Math.random());
                    }
                    
                    const templateIdx = usedTemplates[song.sourceContext].length > 0 
                        ? usedTemplates[song.sourceContext].pop() 
                        : 0;

                    reasonText = templates[templateIdx];

                    return {
                        artist: song.artistName,
                        title: song.trackName,
                        artwork: song.artworkUrl100 ? song.artworkUrl100.replace('100x100', '300x300') : '',
                        previewUrl: song.previewUrl,
                        reason: reasonText
                    };
                });
                
                return {
                    theme: `${weather} 속에서 울려 퍼지는 ${mood} 기분의 ${genre}`,
                    playlist: playlist,
                    tip: "음악의 선율에 귀를 기울이고, 지금 이 순간의 분위기를 마음껏 즐겨보세요!"
                };
            }
        } catch (e) {
            console.error('API Error:', e);
        }

        // 검색 실패 시 기본 fallback 응답
        return {
            theme: `${weather} 속에서 느껴지는 ${mood} 감성, 그리고 ${genre}의 조화`,
            playlist: [
                {
                    artist: `추천 ${genre} 아티스트 1`,
                    title: `${mood} 기분을 위한 플레이리스트`,
                    reason: `입력하신 ${genre} 스타일에 맞춰 선곡된 곡으로, ${weather}에 듣기 매우 좋습니다.`
                },
                {
                    artist: `추천 ${genre} 아티스트 2`,
                    title: `${weather}의 멜로디`,
                    reason: `${mood} 기분과 ${genre} 감성이 완벽하게 조화된 매력적인 트랙입니다.`
                }
            ],
            tip: "시원한 음료나 따뜻한 차 한 잔을 곁들이며 눈을 감고 음악에 빠져보세요!"
        };
    }

    let currentAudio = null;
    let playingCard = null;

    function renderPlaylist(data) {
        playlistContainer.innerHTML = '';
        data.playlist.forEach((song, index) => {
            const card = document.createElement('div');
            card.className = 'song-card';
            card.innerHTML = `
                <div class="song-number">0${index + 1}</div>
                <div class="song-artwork">
                    <img src="${song.artwork || 'https://via.placeholder.com/150/1e1e1e/ffffff?text=No+Cover'}" alt="${song.title} 앨범 커버" loading="lazy">
                    ${song.previewUrl ? `
                    <div class="play-overlay">
                        <svg class="play-icon" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        <svg class="pause-icon" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                    </div>` : ''}
                </div>
                <div class="song-basic-info">
                    <div class="song-title">${song.title}</div>
                    <div class="song-artist">${song.artist}</div>
                </div>
                <div class="song-info">
                    <div class="song-reason">${song.reason}</div>
                </div>
            `;
            
            if (song.previewUrl) {
                card.classList.add('playable');
                card.addEventListener('click', () => {
                    togglePlay(song.previewUrl, card);
                });
            }
            
            playlistContainer.appendChild(card);
        });

        resultSection.classList.remove('hidden');
        
        setTimeout(() => {
            resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    function togglePlay(previewUrl, card) {
        if (currentAudio && currentAudio.src === previewUrl) {
            if (currentAudio.paused) {
                currentAudio.play();
                card.classList.add('playing');
            } else {
                currentAudio.pause();
                card.classList.remove('playing');
            }
        } else {
            if (currentAudio) {
                currentAudio.pause();
                if (playingCard) playingCard.classList.remove('playing');
            }
            currentAudio = new Audio(previewUrl);
            currentAudio.play();
            card.classList.add('playing');
            playingCard = card;
            
            currentAudio.addEventListener('ended', () => {
                card.classList.remove('playing');
            });
        }
    }
});
