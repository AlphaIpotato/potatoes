import React, {useEffect, useRef, useState} from "react";
import {useLocation} from "react-router-dom";
import {MapContext} from './MapContext';
import '../assets/styles/DamageMap.css';

function DamageMap() {
    const url = "http://10.97.30.236:8000";
    const url2 = "http://10.97.30.236:8002";

    if (!window.naver) return null;
    const {naver} = window;

    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const roadMarkersRef = useRef([]);
    const sinkholeMarkersRef = useRef([]);
    const subsidenceMarkersRef = useRef([]);
    const location = useLocation();

    const [fetchedRoadData, setFetchedRoadData] = useState(null);
    const [fetchedGGData, setFetchedGGData] = useState(null);
    const [fetchedSSData, setFetchedSSData] = useState(null);

    const road_data = location.state?.roadData || fetchedRoadData || [];
    const gg_data = location.state?.ggData || fetchedGGData || [];
    const ss_data = location.state?.ssData || fetchedSSData || [];

    console.log("road_data: ", road_data);
    console.log("gg_data: ", gg_data);
    console.log("ss_data: ", ss_data);

    const normalizeSubsidence = (raw) => {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        const candidates = [raw.results, raw.data, raw.items, raw.list, raw.records];
        const firstArray = candidates.find(arr => Array.isArray(arr));
        if (firstArray) return firstArray;
        if (Array.isArray(raw.features)) {
            return raw.features
                .map(f => {
                    const coords = f?.geometry?.coordinates;
                    if (Array.isArray(coords) && coords.length >= 2) {
                        const lng = parseFloat(coords[0]);
                        const lat = parseFloat(coords[1]);
                        return isNaN(lat) || isNaN(lng) ? null : {
                            lat,
                            lng,
                            name: f?.properties?.name || f?.properties?.title || '지하안전정보'
                        };
                    }
                    return null;
                })
                .filter(Boolean);
        }
        return [];
    };

    const subsidenceList = normalizeSubsidence(location.state?.ssData || fetchedSSData);
    const filteredData = road_data.filter(road => !!road.roadreport_latlng);

    const [chatInput, setChatInput] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [messages, setMessages] = useState([
        {id: 'bot-hello', role: 'bot', text: '무엇을 도와드릴까요?'}
    ]);

    const openChatbox = () => {
        setIsChatOpen(true);
    };

    const closeChatbox = () => {
        setIsChatOpen(false);
    };

    useEffect(() => {
        if (mapInstance.current) return;

        const map = new naver.maps.Map(mapRef.current, {
            center: new naver.maps.LatLng(36.320284, 127.998343),
            zoom: 7,
            minZoom: 7,
            zoomControl: true,
            zoomControlOptions: {
                position: naver.maps.Position.TOP_RIGHT,
            },
        });

        mapInstance.current = map;

        // init 이벤트 이후 Control 설정 및 마커 강제 재생성
        naver.maps.Event.once(map, 'init', () => {
            console.log('NAVER Maps JavaScript API v3 초기화 완료 - DamageMap');
            map.setOptions("mapTypeControl", true);
            
            // 지도 초기화 완료 후 마커들을 강제로 다시 생성
            setTimeout(() => {
                console.log('지도 init 완료 후 마커 재생성 시작');
                
                // gg_data 마커 강제 재생성
                if (gg_data && gg_data.length > 0) {
                    console.log('gg_data 마커 강제 재생성:', gg_data.length);
                    sinkholeMarkersRef.current.forEach(m => m.setMap(null));
                    sinkholeMarkersRef.current = [];
                    
                    gg_data.forEach(item => {
                        const lat = parseFloat(item.latitude || item.lat || item.y || item.Y);
                        const lng = parseFloat(item.longitude || item.lng || item.x || item.X);
                        
                        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                            const marker = new naver.maps.Marker({
                                position: new naver.maps.LatLng(lat, lng),
                                map: map,
                                icon: {
                                    url: "/media/icon_sinkhole.png",
                                    size: new naver.maps.Size(32, 32),
                                    origin: new naver.maps.Point(0, 0),
                                    anchor: new naver.maps.Point(16, 16)
                                }
                            });
                            sinkholeMarkersRef.current.push(marker);
                            // console.log(`[init] gg_data 마커 생성: ${lat}, ${lng}`);
                        }
                    });
                }
                
                // ss_data (subsidenceList) 마커 강제 재생성
                if (subsidenceList && subsidenceList.length > 0) {
                    console.log('ss_data 마커 강제 재생성:', subsidenceList.length);
                    subsidenceMarkersRef.current.forEach(m => m.setMap(null));
                    subsidenceMarkersRef.current = [];
                    
                    subsidenceList.forEach(item => {
                        const lat = parseFloat(item?.latitude ?? item?.lat ?? item?.y ?? item?.Y);
                        const lng = parseFloat(item?.longitude ?? item?.lng ?? item?.x ?? item?.X);
                        
                        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                            const marker = new naver.maps.Marker({
                                position: new naver.maps.LatLng(lat, lng),
                                map: map,
                                icon: {
                                    url: "/media/icon_undergroundSafe.png",
                                    size: new naver.maps.Size(24, 24),
                                    anchor: new naver.maps.Point(12, 12)
                                }
                            });
                            subsidenceMarkersRef.current.push(marker);
                            // console.log(`[init] ss_data 마커 생성: ${lat}, ${lng}`);
                        }
                    });
                }
            }, 500);
        });
    }, []);

    // 도로 마커 생성 + 인포윈도우 (데이터 변경 시 갱신)
    useEffect(() => {
        const map = mapInstance.current;
        if (!map) return;
        console.log('[roadreport] filteredData count:', filteredData.length);
        // clear existing road markers
        roadMarkersRef.current.forEach(m => m.setMap(null));
        roadMarkersRef.current = [];

        filteredData.forEach((road) => {
            if (!road.roadreport_latlng) return;
            const [lat, lng] = road.roadreport_latlng.split(",").map(coord => parseFloat(coord.trim()));
            const iconType = road.roadreport_damagetype.includes("pothole")
                ? "/media/icon_pothole.png"
                : "/media/icon_crack.png";

            const marker = new naver.maps.Marker({
                position: new naver.maps.LatLng(lat, lng),
                map,
                icon: {
                    url: iconType,
                    size: new naver.maps.Size(32, 32),
                    origin: new naver.maps.Point(0, 0),
                    anchor: new naver.maps.Point(16, 16)
                }
            });
            // console.log('[roadreport] marker at:', { lat, lng, status: road.roadreport_status });

            const displayTime = (() => {
                if (road.ymd && road.hms) return `${road.ymd} ${String(road.hms).slice(0, 8)}`;
                if (road.roadreport_time) {
                    const parts = String(road.roadreport_time).split('T');
                    if (parts.length === 2) return `${parts[0]} ${parts[1].slice(0, 8)}`;
                }
                return '-';
            })();

            const coordText = `위도 ${Number(lat).toFixed(6)}, 경도 ${Number(lng).toFixed(6)}`;
            const infoHtml = `
                <div style="font-size:12px; line-height:1.4; padding:6px 8px; max-width: 260px;">
                    <div style="font-weight:700; margin-bottom:2px;">${road.roadreport_address || 'Dorosee 데이터'}</div>
                    <div style="color:#555">${coordText}</div>
                    <div>상태: ${road.roadreport_status || '-'}</div>
                    <div>접수: ${displayTime}</div>
                </div>`;
            const infoWindow = new naver.maps.InfoWindow({
                content: infoHtml,
                backgroundColor: '#fff',
                borderColor: '#ddd',
                borderWidth: 1,
                anchorSize: new naver.maps.Size(8, 8),
                disableAnchor: false
            });

            naver.maps.Event.addListener(marker, 'mouseover', () => {
                infoWindow.open(map, marker);
            });
            naver.maps.Event.addListener(marker, 'mouseout', () => {
                infoWindow.close();
            });
            naver.maps.Event.addListener(marker, 'click', () => {
                if (infoWindow.getMap()) infoWindow.close(); else infoWindow.open(map, marker);
            });
            roadMarkersRef.current.push(marker);
        });
    }, [filteredData]);

    // If navigated directly without state, fetch all datasets (no reload)
    useEffect(() => {
        async function ensureData() {
            const needRoad = !location.state?.roadData && !fetchedRoadData;
            const needGG = !location.state?.ggData && !fetchedGGData;
            const needSS = !location.state?.ssData && !fetchedSSData;
            if (!(needRoad || needGG || needSS)) return;
            try {
                const promises = [];
                if (needRoad) promises.push(fetch(`${url}/roadreport/all`, {headers: {'Content-Type': 'application/json'}})); else promises.push(Promise.resolve(null));
                if (needGG) promises.push(fetch(`${url}/gg/subsidence/`, {headers: {'Content-Type': 'application/json'}})); else promises.push(Promise.resolve(null));
                if (needSS) promises.push(fetch(`${url}/api/subsidence/coords/`, {headers: {'Content-Type': 'application/json'}})); else promises.push(Promise.resolve(null));
                const [r, g, s] = await Promise.all(promises);
                if (r) console.log('[fetch] road status:', r.status);
                if (g) console.log('[fetch] ggdata status:', g.status);
                if (s) console.log('[fetch] subsidence status:', s.status);
                if (r && r.ok) {
                    const data = await r.json();
                    console.log('[fetch] road length:', Array.isArray(data) ? data.length : Object.keys(data || {}).length);
                    setFetchedRoadData(data);
                }
                if (g && g.ok) {
                    const data = await g.json();
                    console.log('[fetch] gg subsidence data:', { 
                        length: Array.isArray(data) ? data.length : 'not array',
                        type: typeof data,
                        keys: Object.keys(data || {}),
                        first_item: data?.[0] || data,
                        url: `${url}/gg/subsidence/`
                    });
                    setFetchedGGData(data);
                } else {
                    console.error('[fetch] gg subsidence failed:', g?.status, g?.statusText);
                }
                if (s && s.ok) {
                    const data = await s.json();
                    const arr = normalizeSubsidence(data);
                    console.log('[fetch] subsidence normalized length:', arr.length);
                    setFetchedSSData(data);
                }
            } catch (_) {
                // ignore partial failure
            }
        }

        ensureData();
    }, [location.state, fetchedRoadData, fetchedGGData, fetchedSSData, url]);

    // 지반침하 데이터 마커 (ggdata) - ssdata 스타일로 통일
    useEffect(() => {
        const map = mapInstance.current;
        if (!map || !Array.isArray(gg_data)) {
            console.log('[ggdata] 지도 또는 데이터 없음:', { map: !!map, gg_data: gg_data?.length });
            return;
        }

        // clear existing sinkhole markers
        sinkholeMarkersRef.current.forEach(m => m.setMap(null));
        sinkholeMarkersRef.current = [];

        if (gg_data.length === 0) {
            console.log('[ggdata] 데이터가 없습니다');
            return;
        }

        gg_data.forEach((item, index) => {
            const lat = parseFloat(item.latitude || item.lat || item.y || item.Y);
            const lng = parseFloat(item.longitude || item.lng || item.x || item.X);
            
            // 다양한 주소 필드를 처리
            let address = '';
            if (item.SIDO_NM || item.SIGNGU_NM || item.TGRD_SUBSID_REGION_DETAIL_INFO) {
                address = `${item.SIDO_NM || ''} ${item.SIGNGU_NM || ''} ${item.TGRD_SUBSID_REGION_DETAIL_INFO || ''}`.trim();
            } else {
                // 다른 주소 필드 시도
                const addressParts = [
                    item.sido,
                    item.sigungu,
                    item.dong || item.dongNm,
                    item.addr || item.address
                ].filter(Boolean);
                address = addressParts.join(' ') || '주소 정보 없음';
            }

            if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                const marker = new naver.maps.Marker({
                    position: new naver.maps.LatLng(lat, lng),
                    map: map,
                    icon: {
                        url: "/media/icon_sinkhole.png",
                        size: new naver.maps.Size(32, 32),
                        origin: new naver.maps.Point(0, 0),
                        anchor: new naver.maps.Point(16, 16)
                    }
                });
                
                const infoHtml = `
                    <div style="font-size:12px; line-height:1.4; padding:6px 8px; max-width: 220px;">
                        <div style="font-weight:700; margin-bottom:2px;">지반침하 의심</div>
                        <div style="color:#555;">${address}</div>
                        <div>위도: ${lat.toFixed(6)}, 경도: ${lng.toFixed(6)}</div>
                        ${item.sagoNo ? `<div style="color:#888; font-size:10px; margin-top:2px;">사고번호: ${item.sagoNo}</div>` : ''}
                    </div>`;
                    
                const infoWindow = new naver.maps.InfoWindow({content: infoHtml});
                naver.maps.Event.addListener(marker, 'click', () => {
                    if (infoWindow.getMap()) {
                        infoWindow.close();
                    } else {
                        infoWindow.open(map, marker);
                    }
                });
                naver.maps.Event.addListener(marker, 'mouseover', () => infoWindow.open(map, marker));
                naver.maps.Event.addListener(marker, 'mouseout', () => infoWindow.close());
                
                sinkholeMarkersRef.current.push(marker);
                // console.log(`[ggdata] 마커 생성 성공: ${lat}, ${lng} - ${address}`);
            } else {
                console.log(`[ggdata] 유효하지 않은 좌표:`, { lat, lng, item });
            }
        });
        
        console.log(`[ggdata] ${sinkholeMarkersRef.current.length} / ${gg_data.length}`);
    }, [gg_data]);

    // 지하안전정보 리스트 마커
    useEffect(() => {
        const map = mapInstance.current;
        if (!map || !Array.isArray(subsidenceList)) return;
        console.log('[subsidence_list] items count:', subsidenceList.length);
        // 기존 마커 제거
        subsidenceMarkersRef.current.forEach(m => m.setMap(null));
        subsidenceMarkersRef.current = [];

        const placeMarker = (lat, lng, item, builtAddress) => {
            const marker = new naver.maps.Marker({
                position: new naver.maps.LatLng(lat, lng),
                map,
                icon: {
                    url: "/media/icon_undergroundSafe.png",
                    size: new naver.maps.Size(24, 24),
                    anchor: new naver.maps.Point(12, 12)
                }
            });
            const label = item?.name || item?.title || '지하안전정보';
            const infoHtml = `
                <div style="font-size:12px; line-height:1.4; padding:6px 8px; max-width: 240px;">
                    <div style="font-weight:700; margin-bottom:2px;">${label}</div>
                    ${builtAddress ? `<div style="color:#555">${builtAddress}</div>` : ''}
                    <div>위도 ${lat.toFixed(6)}, 경도 ${lng.toFixed(6)}</div>
                </div>`;
            const infoWindow = new naver.maps.InfoWindow({content: infoHtml});
            naver.maps.Event.addListener(marker, 'mouseover', () => infoWindow.open(map, marker));
            naver.maps.Event.addListener(marker, 'mouseout', () => infoWindow.close());
            subsidenceMarkersRef.current.push(marker);
        };

        subsidenceList.forEach(item => {
            const lat = parseFloat(item?.latitude ?? item?.lat ?? item?.y ?? item?.Y);
            const lng = parseFloat(item?.longitude ?? item?.lng ?? item?.x ?? item?.X);

            const builtAddressParts = [
                item?.sido,
                item?.sigungu,
                (item?.dong || item?.dongNm || item?.dongName),
                (item?.addr || item?.address || item?.detailAddr || item?.detailAddress || item?.roadAddress)
            ];
            const builtAddress = builtAddressParts.filter(Boolean).join(' ');

            if (!isNaN(lat) && !isNaN(lng)) {
                placeMarker(lat, lng, item, builtAddress);
            }
        });
    }, [subsidenceList]);

    async function requestChatbot(user_question) {
        try {
            const chatResponse = await fetch(`${url2}/chat/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({user_question}),
            });

            const result = await chatResponse.json();

            if (chatResponse.ok) {
                console.log('chat:', result);
            } else {
                console.error('chat error:', chatResponse.status, result);
            }

            return result;
        } catch (error) {
            console.error('error:', error);
            return null;
        }
    }

    const handleSend = async () => {
        const text = chatInput.trim();
        if (!text) return;
        const userMsg = {id: `user-${Date.now()}`, role: 'user', text};
        setMessages(prev => [...prev, userMsg]);
        setChatInput('');

        const result = await requestChatbot(text);
        const botText = result?.response || '죄송해요, 현재 답변을 가져올 수 없어요.';
        const botMsg = {id: `bot-${Date.now()}`, role: 'bot', text: botText};
        setMessages(prev => [...prev, botMsg]);
    };

    return (
        <MapContext.Provider value={true}>
            <div className="map-app-container">
                <div id="map" ref={mapRef} style={{width: '100%', height: '100%'}}></div>

                <div className="floating">
                    <button className="float-action-button" onClick={() => openChatbox()}>
                        <img src="/media/chatbot.png" alt="chatbot"/>
                    </button>
                </div>

                {isChatOpen && (
                    <div className="chat-background" onClick={closeChatbox}>
                        <div className="chat-box" onClick={(e) => e.stopPropagation()}>
                            <button className="chat-close" onClick={closeChatbox}>X</button>
                            <div className="chat-messages">
                                {messages.map(m => (
                                    <div key={m.id} className={`msg-row ${m.role}`}>
                                        <div className={`msg-bubble ${m.role}`}>{m.text}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="chat-input-row">
                                <textarea
                                    className="chat-area"
                                    id="chat_Input"
                                    value={chatInput}
                                    placeholder="메시지를 입력하세요"
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                />
                                <button className="chat-submit" onClick={handleSend}>보내기</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MapContext.Provider>
    );
}

export default DamageMap;
