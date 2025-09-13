import React, {useEffect, useRef, useState, useMemo} from "react";
import {useLocation} from "react-router-dom";
import ChartistGraph from "react-chartist";
import {
    Card,
    Container,
    Row,
    Col,
    Button,
} from "react-bootstrap";

// Error Boundary 컴포넌트
class AdminDataErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('AdminData Error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="admin-page">
                    <Container fluid>
                        <div style={{textAlign: "center", paddingTop: "100px"}}>
                            <h3>오류가 발생했습니다</h3>
                            <p>통계 페이지를 로드하는 중 오류가 발생했습니다.</p>
                            <Button onClick={() => window.location.reload()}>
                                페이지 새로고침
                            </Button>
                        </div>
                    </Container>
                </div>
            );
        }

        return this.props.children;
    }
}

function AdminData() {
    const location = useLocation();
    const url = "http://localhost:8000";
    
    // location.state에서 데이터를 가져오거나, 직접 API에서 가져오기
    const road_data = location.state?.roadData || location.state?.fetchedData || [];
    const [fetchedData, setFetchedData] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);
    
    // ggdata와 ssdata 상태 추가
    const [ggData, setGgData] = useState([]);
    const [ssData, setSsData] = useState([]);
    const [ggDataLoading, setGgDataLoading] = useState(true);
    const [ssDataLoading, setSsDataLoading] = useState(true);

    // 데이터가 없으면 API에서 직접 가져오기
    useEffect(() => {
        if (road_data.length === 0) {
            const fetchData = async () => {
                try {
                    const response = await fetch(`${url}/roadreport/all`, {
                        method: "GET",
                        headers: {'Content-Type': 'application/json'},
                    });
                    if (response.ok) {
                        const data = await response.json();
                        setFetchedData(data);
                    }
                } catch (error) {
                    console.error("데이터 가져오기 실패:", error);
                } finally {
                    setDataLoading(false);
                }
            };
            fetchData();
        } else {
            setFetchedData(road_data);
            setDataLoading(false);
        }
    }, [road_data]);

    // ggdata와 ssdata 가져오기
    useEffect(() => {
        const fetchAdditionalData = async () => {
            try {
                const [ggResponse, ssResponse] = await Promise.all([
                    fetch(`${url}/gg/subsidence/`, {
                        method: "GET",
                        headers: {'Content-Type': 'application/json'},
                    }),
                    fetch(`${url}/api/subsidence/coords/`, {
                        method: "GET",
                        headers: {'Content-Type': 'application/json'},
                    })
                ]);

                if (ggResponse.ok) {
                    const ggData = await ggResponse.json();
                    setGgData(Array.isArray(ggData) ? ggData : []);
                    console.log('[AdminData] ggdata loaded:', Array.isArray(ggData) ? ggData.length : 'not array');
                }
                setGgDataLoading(false);

                if (ssResponse.ok) {
                    const ssData = await ssResponse.json();
                    setSsData(Array.isArray(ssData) ? ssData : []);
                    console.log('[AdminData] ssdata loaded:', Array.isArray(ssData) ? ssData.length : 'not array');
                }
                setSsDataLoading(false);
            } catch (error) {
                console.error("추가 데이터 가져오기 실패:", error);
                setGgDataLoading(false);
                setSsDataLoading(false);
            }
        };

        fetchAdditionalData();
    }, [url]);

    const allRoadData = road_data.length > 0 ? road_data : fetchedData;
    const filteredData = allRoadData.filter(road => road.roadreport_image);

    const naver = window.naver || null;
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const [loading, setLoading] = useState(true);
    
    // 마커 ref 추가
    const ggMarkersRef = useRef([]);
    const ssMarkersRef = useRef([]);
    const roadMarkersRef = useRef([]);

    // ===== 통계/레코드 CSV 내보내기 =====
    const toCSV = (rows) => {
        const escape = (val) => {
            if (val === undefined || val === null) return "";
            const s = String(val).replace(/"/g, '""');
            return /[",\n]/.test(s) ? `"${s}"` : s;
        };
        return rows.map(r => r.map(escape).join(",")).join("\n");
    };

    const download = (filename, content) => {
        // UTF-8 BOM을 붙여 한글 깨짐 방지(특히 Excel)
        const contentWithBom = "\uFEFF" + content;
        const blob = new Blob([contentWithBom], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    };

    // CSV 내보내기 함수들은 변수 정의 이후로 이동

    const deriveSource = (road) => {
        if (road.user_id || road.report_user || road.reporter) return "사용자";
        if (road.source || road.api_source || road.provider) return road.source || road.api_source || road.provider;
        return "알수없음";
    };

    const deriveReporter = (road) => {
        return road.user_id || road.report_user || road.reporter || "";
    };

    // 시간 형식 맞추기 - 변수들을 먼저 정의
    const road_date = new Date();
    const now_ymd = `${road_date.getFullYear()}-${(road_date.getMonth() + 1).toString().padStart(2, "0")}-${road_date.getDate().toString().padStart(2, "0")}`;

    const agoWeek = new Date(road_date);
    agoWeek.setDate(road_date.getDate() - 7);
    const roadWeek = road_date.getDate() < 8 ? (`${road_date.getFullYear()}-${(road_date.getMonth()).toString().padStart(2, "0")}-${agoWeek.getDate().toString().padStart(2, "0")}`) :
        (`${road_date.getFullYear()}-${(road_date.getMonth() + 1).toString().padStart(2, "0")}-${agoWeek.getDate().toString().padStart(2, "0")}`);

    const agoMonth = new Date(road_date);
    agoMonth.setDate(road_date.getDate() - 30);
    const roadMonth = `${road_date.getFullYear()}-${(agoMonth.getMonth() + 1).toString().padStart(2, "0")}-${agoMonth.getDate().toString().padStart(2, "0")}`;

    useEffect(() => {
        if (filteredData.length > 0 && !dataLoading) {
            setLoading(false);
        }
    }, [filteredData, dataLoading]);

    // console.log("현재 연월일: ", now_ymd);
    // console.log("roadWeek: ", roadWeek);
    // console.log("roadMonth: ", roadMonth);
    // console.log("now_ymd: ", now_ymd);

    filteredData.forEach((road) => {
        if (road.roadreport_time) {
            const [ymd, hms] = road.roadreport_time.split("T");
            road.ymd = ymd;
            road.hms = hms;
        } else {
            console.log(`num ${road.roadreport_num} time 없음`);
        }
    });

    const monthData = filteredData.filter(
        (road) => road.ymd >= roadMonth
    );

    // 지역별 통계 계산
    const regionalStats = useMemo(() => {
        const ggRegionalStats = {};
        const ssRegionalStats = {};
        const roadRegionalStats = {};

        // ggdata 지역별 통계
        ggData.forEach(item => {
            const sido = item.SIDO_NM || item.sido || '기타';
            if (!ggRegionalStats[sido]) {
                ggRegionalStats[sido] = 0;
            }
            ggRegionalStats[sido]++;
        });

        // ssdata 지역별 통계
        ssData.forEach(item => {
            const sido = item.sido || '기타';
            if (!ssRegionalStats[sido]) {
                ssRegionalStats[sido] = 0;
            }
            ssRegionalStats[sido]++;
        });

        // roadreport 지역별 통계
        filteredData.forEach(item => {
            const sido = item.sido || '기타';
            if (!roadRegionalStats[sido]) {
                roadRegionalStats[sido] = 0;
            }
            roadRegionalStats[sido]++;
        });

        // 모든 지역 통합
        const allRegions = new Set([
            ...Object.keys(ggRegionalStats),
            ...Object.keys(ssRegionalStats),
            ...Object.keys(roadRegionalStats)
        ]);

        const combinedStats = Array.from(allRegions).map(region => ({
            region,
            ggCount: ggRegionalStats[region] || 0,
            ssCount: ssRegionalStats[region] || 0,
            roadCount: roadRegionalStats[region] || 0,
            total: (ggRegionalStats[region] || 0) + (ssRegionalStats[region] || 0) + (roadRegionalStats[region] || 0)
        })).sort((a, b) => b.total - a.total);

        return {
            ggRegionalStats,
            ssRegionalStats,
            roadRegionalStats,
            combinedStats
        };
    }, [ggData, ssData, filteredData]);

    // 월별 통계 (원그래프)
    // 포트홀과 크랙이 동시에 있는 경우 포트홀로 분류함

    const potholeCount = monthData.filter(
        (road => (typeof road.roadreport_damagetype === 'string' && road.roadreport_damagetype.includes("pothole") && road.roadreport_status !== "해결됨"))).length;
    const crackCount = monthData.filter(
        (road => (road.roadreport_damagetype === "crack" && road.roadreport_status !== "해결됨"))).length;
    const solvedCount = monthData.filter(
        (road => road.roadreport_status === "해결됨")).length;

    const totalMonthCount = potholeCount + crackCount + solvedCount;

    const potholePercent = totalMonthCount > 0 ? Math.round((potholeCount / totalMonthCount) * 100) : 0;
    const crackPercent = totalMonthCount > 0 ? Math.round((crackCount / totalMonthCount) * 100) : 0;
    const solvedPercent = totalMonthCount > 0 ? Math.round((solvedCount / totalMonthCount) * 100) : 0;

    // console.log("potholeCount: ", potholeCount);
    // console.log("crackCount: ", crackCount);
    // console.log("solvedCount: ", solvedCount);

    // console.log("potholePercent: ", potholePercent);
    // console.log("crackPercent: ", crackPercent);
    // console.log("solvedPercent: ", solvedPercent);

    // CSV 내보내기 함수들 (변수 정의 이후에 위치)
    const exportStatsCSV = () => {
        const headers = ["지표", "값"];
        const monthLabel = roadMonth?.slice(0,7) || now_ymd.slice(0,7); // YYYY-MM
        const rows = [headers,
            ["기준일", now_ymd],
            ["월간 기간", `${roadMonth} ~ ${now_ymd}`],
            ["월(YYYY-MM)", monthLabel],
            ["전체", filteredData.length],
            ["접수됨", filteredData.filter(r => r.roadreport_status === "접수됨").length],
            ["처리중", filteredData.filter(r => r.roadreport_status === "처리중").length],
            ["해결됨", filteredData.filter(r => r.roadreport_status === "해결됨").length],
            ["보류중", filteredData.filter(r => r.roadreport_status === "보류중").length],
            ["미분류", filteredData.filter(r => !["접수됨","처리중","해결됨","보류중"].includes(r.roadreport_status)).length],
            ["월간 총건수", monthData.length],
            ["월간 포트홀", potholeCount],
            ["월간 크랙", crackCount],
            ["월간 해결됨", solvedCount],
        ];
        download(`stats_${monthLabel}.csv`, toCSV(rows));
    };

    const exportRecordsCSV = () => {
        const headers = ["시간","유형","상태","주소","좌표","소스","신고자"];
        const rows = [headers];
        filteredData.forEach(r => {
            const when = r.roadreport_time || r.time || "";
            rows.push([
                when,
                r.roadreport_damagetype || r.type || "",
                r.roadreport_status || r.status || "",
                r.roadreport_region || r.address || "",
                r.roadreport_latlng || `${r.lat||''},${r.lng||''}`,
                deriveSource(r),
                deriveReporter(r)
            ]);
        });
        download(`reports_${now_ymd}.csv`, toCSV(rows));
    };

    // 지도 초기화 (한 번만 실행)
    useEffect(() => {
        let timeoutId;
        let retryCount = 0;
        const maxRetries = 20; // 최대 2초 대기 (100ms * 20)

        const initializeMap = () => {
            // 네이버 지도 API가 로드되지 않았으면 대기
            if (!window.naver || !window.naver.maps || !naver) {
                if (retryCount < maxRetries) {
                    retryCount++;
                    timeoutId = setTimeout(initializeMap, 100);
                }
                return;
            }

            // mapRef가 유효하고 실제로 DOM에 렌더링되었는지 확인
            if (!mapRef.current || !mapRef.current.offsetParent) {
                if (retryCount < maxRetries) {
                    retryCount++;
                    timeoutId = setTimeout(initializeMap, 100);
                }
                return;
            }

            // 이미 지도가 초기화되었으면 건너뛰기
            if (mapInstance.current) {
                return;
            }

            try {
                const map = new naver.maps.Map(mapRef.current, {
                    center: new naver.maps.LatLng(36.193344, 127.934838),
                    zoom: 7,
                    minZoom: 7,
                    zoomControl: true,
                    zoomControlOptions: {
                        position: naver.maps.Position.TOP_RIGHT,
                    },
                });

                mapInstance.current = map;

                // init 이벤트 이후 Control과 Event Listener 설정
                naver.maps.Event.once(map, "init", () => {
                    console.log("NAVER Maps JavaScript API v3 초기화 완료 - AdminData");
                    
                    // Control 설정
                    map.setOptions("mapTypeControl", true);
                    
                    // Event Listener 추가
                    naver.maps.Event.addListener(map, "zoom_changed", (zoom) => {
                        // console.log("zoom:", zoom);
                    });

                    // 지도 초기화 완료 후 마커들을 강제로 다시 생성
                    setTimeout(() => {
                        console.log('지도 init 완료 후 마커 재생성 시작');
                        
                        // roadreport 마커 강제 재생성
                        if (filteredData && filteredData.length > 0) {
                            console.log('roadreport 마커 강제 재생성:', filteredData.length);
                            roadMarkersRef.current.forEach(marker => marker.setMap(null));
                            roadMarkersRef.current = [];
                            
                            filteredData.forEach((item, index) => {
                                if (item.roadreport_latlng) {
                                    const [lat, lng] = item.roadreport_latlng.split(",").map(coord => parseFloat(coord.trim()));
                                    const damageType = item.roadreport_damagetype || '';

                                    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                                        let iconUrl = "/media/icon_crack.png";
                                        if (damageType.includes("pothole")) {
                                            iconUrl = "/media/icon_pothole.png";
                                        }

                                        const marker = new naver.maps.Marker({
                                            position: new naver.maps.LatLng(lat, lng),
                                            map: map,
                                            icon: {
                                                url: iconUrl,
                                                size: new naver.maps.Size(32, 32),
                                                origin: new naver.maps.Point(0, 0),
                                                anchor: new naver.maps.Point(16, 16)
                                            }
                                        });
                                        roadMarkersRef.current.push(marker);
                                    }
                                }
                            });
                        }

                        // ggdata 마커 강제 재생성
                        if (ggData && ggData.length > 0) {
                            console.log('ggdata 마커 강제 재생성:', ggData.length);
                            ggMarkersRef.current.forEach(marker => marker.setMap(null));
                            ggMarkersRef.current = [];
                            
                            ggData.forEach(item => {
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
                                    ggMarkersRef.current.push(marker);
                                    console.log(`[init] ggdata 마커 생성: ${lat}, ${lng}`);
                                }
                            });
                        }

                        // ssdata 마커 강제 재생성
                        if (ssData && ssData.length > 0) {
                            console.log('ssdata 마커 강제 재생성:', ssData.length);
                            ssMarkersRef.current.forEach(marker => marker.setMap(null));
                            ssMarkersRef.current = [];
                            
                            ssData.forEach(item => {
                                const lat = parseFloat(item?.latitude ?? item?.lat ?? item?.y ?? item?.Y);
                                const lng = parseFloat(item?.longitude ?? item?.lng ?? item?.x ?? item?.X);
                                
                                if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                                    const marker = new naver.maps.Marker({
                                        position: new naver.maps.LatLng(lat, lng),
                                        map: map,
                                        icon: {
                                            url: "/media/icon_undergroundSafe.png",
                                            size: new naver.maps.Size(32, 32),
                                            origin: new naver.maps.Point(0, 0),
                                            anchor: new naver.maps.Point(16, 16)
                                        }
                                    });
                                    ssMarkersRef.current.push(marker);
                                    console.log(`[init] ssdata 마커 생성: ${lat}, ${lng}`);
                                }
                            });
                        }
                    }, 500);
                });
            } catch (error) {
                console.error("지도 초기화 중 오류:", error);
                if (retryCount < maxRetries) {
                    retryCount++;
                    timeoutId = setTimeout(initializeMap, 100);
                }
            }
        };

        // 컴포넌트가 마운트된 후 약간의 지연을 두고 초기화 시작
        timeoutId = setTimeout(initializeMap, 100);

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };

    }, []); // 의존성 배열을 빈 배열로 변경하여 한 번만 실행

    // 마커 업데이트 (데이터 변경 시에만 실행)
    useEffect(() => {
        if (!mapInstance.current || !filteredData || filteredData.length === 0) {
            return;
        }

        // 기존 마커들 제거 (전역 마커 배열이 있다면)
        // markers.forEach(marker => marker.setMap(null));
        // markers.length = 0;

        // roadreport 마커는 별도 useEffect에서 처리됨


    }, [filteredData]); // mapInstance는 ref이므로 의존성에서 제외

    // ggdata 마커 생성
    useEffect(() => {
        if (!mapInstance.current || !ggData || ggData.length === 0) {
            return;
        }

        // 기존 ggdata 마커들 제거
        ggMarkersRef.current.forEach(marker => marker.setMap(null));
        ggMarkersRef.current = [];

        ggData.forEach(item => {
            const lat = parseFloat(item.latitude || item.lat || item.y || item.Y);
            const lng = parseFloat(item.longitude || item.lng || item.x || item.X);

            if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                const marker = new naver.maps.Marker({
                    position: new naver.maps.LatLng(lat, lng),
                    map: mapInstance.current,
                    icon: {
                        url: "/media/icon_sinkhole.png",
                        size: new naver.maps.Size(24, 24),
                        origin: new naver.maps.Point(0, 0),
                        anchor: new naver.maps.Point(12, 12)
                    }
                });
                ggMarkersRef.current.push(marker);
            }
        });

        console.log(`[AdminData] ggdata 마커 ${ggMarkersRef.current.length}개 생성됨`);
    }, [ggData]);

    // ssdata 마커 생성
    useEffect(() => {
        if (!mapInstance.current || !ssData || ssData.length === 0) {
            return;
        }

        // 기존 ssdata 마커들 제거
        ssMarkersRef.current.forEach(marker => marker.setMap(null));
        ssMarkersRef.current = [];

        ssData.forEach(item => {
            const lat = parseFloat(item?.latitude ?? item?.lat ?? item?.y ?? item?.Y);
            const lng = parseFloat(item?.longitude ?? item?.lng ?? item?.x ?? item?.X);

            if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                const marker = new naver.maps.Marker({
                    position: new naver.maps.LatLng(lat, lng),
                    map: mapInstance.current,
                    icon: {
                        url: "/media/icon_undergroundSafe.png",
                        size: new naver.maps.Size(20, 20),
                        origin: new naver.maps.Point(0, 0),
                        anchor: new naver.maps.Point(10, 10)
                    }
                });
                ssMarkersRef.current.push(marker);
            }
        });

        console.log(`[AdminData] ssdata 마커 ${ssMarkersRef.current.length}개 생성됨`);
    }, [ssData]);

    // roadreport 마커 생성
    useEffect(() => {
        console.log('[AdminData] roadreport 마커 useEffect 실행:', {
            mapInstance: !!mapInstance.current,
            filteredData: filteredData?.length,
            dataLoading
        });

        if (!mapInstance.current) {
            console.log('[AdminData] 지도 인스턴스가 없습니다');
            return;
        }

        if (!filteredData || filteredData.length === 0) {
            console.log('[AdminData] filteredData가 없거나 비어있습니다');
            return;
        }

        // 기존 roadreport 마커들 제거
        roadMarkersRef.current.forEach(marker => marker.setMap(null));
        roadMarkersRef.current = [];

        let validMarkerCount = 0;
        filteredData.forEach((item, index) => {
            if (item.roadreport_latlng) {
                const [lat, lng] = item.roadreport_latlng.split(",").map(coord => parseFloat(coord.trim()));
                const damageType = item.roadreport_damagetype || '';

                if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                    let iconUrl = "/media/icon_crack.png"; // 기본값
                    if (damageType.includes("pothole")) {
                        iconUrl = "/media/icon_pothole.png";
                    }

                    try {
                        const marker = new naver.maps.Marker({
                            position: new naver.maps.LatLng(lat, lng),
                            map: mapInstance.current,
                            icon: {
                                url: iconUrl,
                                size: new naver.maps.Size(24, 24),
                                origin: new naver.maps.Point(0, 0),
                                anchor: new naver.maps.Point(12, 12)
                            }
                        });
                        roadMarkersRef.current.push(marker);
                        validMarkerCount++;
                    } catch (error) {
                        console.error(`[AdminData] 마커 생성 실패:`, error);
                    }
                } else {
                    console.log(`[AdminData] 유효하지 않은 좌표: ${lat}, ${lng}`);
                }
            } else {
                console.log(`[AdminData] 아이템 ${index}: roadreport_latlng 없음`);
            }
        });

        console.log(`[AdminData] roadreport 마커 ${validMarkerCount}개 생성됨 (전체 데이터: ${filteredData.length}개)`);
    }, [filteredData, dataLoading]);


    // 좌표로 지역 분류하기 (미구현됨) - 역지오코딩 제거
    // const classifyRegion = () => {
    //     // 역지오코딩 기능 제거됨
    // }

    // 네이버 지도가 로드된 후에만 실행 - 역지오코딩 제거
    // useEffect(() => {
    //     if (window.naver && window.naver.maps && window.naver.maps.Service) {
    //         classifyRegion();
    //     }
    // }, []);


    // 데이터 로딩 중일 때 표시
    if (dataLoading) {
        return (
            <div className="admin-page">
                <Container fluid>
                    <div style={{textAlign: "center", paddingTop: "100px"}}>
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <div>데이터를 불러오는 중...</div>
                    </div>
                </Container>
            </div>
        );
    }

    return (
        <div className="admin-page">
            <Container fluid>
                <Row className="align-items-center">
                    <Col lg="2" sm="6">
                        <Card className="card-stats">
                            <Card.Body>
                                <Row>
                                    <Col>
                                        <div className="numbers">
                                            <p className="card-title">전체</p>
                                            <Card.Text className={`card-perData`}>{filteredData.length}건</Card.Text>
                                        </div>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col lg="2" sm="6">
                        <Card className="card-stats">
                            <Card.Body>
                                <Row>
                                    <Col>
                                        <div className="numbers">
                                            <p className="card-title">접수됨</p>
                                            <Card.Text
                                                className={`card-perData`}>{filteredData.filter(road => road.roadreport_status === "접수됨").length}건</Card.Text>
                                        </div>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col lg="2" sm="6">
                        <Card className="card-stats">
                            <Card.Body>
                                <Row>
                                    <Col>
                                        <div className="numbers">
                                            <p className="card-title">처리됨</p>
                                            <Card.Text
                                                className={`card-perData`}>{filteredData.filter(road => road.roadreport_status === "처리중").length}건</Card.Text>
                                        </div>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col lg="2" sm="6">
                        <Card className="card-stats">
                            <Card.Body>
                                <Row>
                                    <Col>
                                        <div className="numbers">
                                            <p className="card-title">해결됨</p>
                                            <Card.Text
                                                className={`card-perData`}>{filteredData.filter(road => road.roadreport_status === "해결됨").length}건</Card.Text>
                                        </div>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col lg="2" sm="6">
                        <Card className="card-stats">
                            <Card.Body>
                                <Row>
                                    <Col>
                                        <div className="numbers">
                                            <p className="card-title">보류중</p>
                                            <Card.Text
                                                className={`card-perData`}>{filteredData.filter(road => road.roadreport_status === "보류중").length}건</Card.Text>
                                        </div>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col lg="2" sm="6">
                        <Card className="card-stats">
                            <Card.Body>
                                <Row>
                                    <Col>
                                        <div className="numbers">
                                            <p className="card-title">미분류</p>
                                            <Card.Text
                                                className={`card-perData`}>{filteredData.filter(road => !["접수됨", "처리중", "해결됨", "보류중"].includes(road.roadreport_status)).length}건</Card.Text>
                                        </div>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    </Col>
                    {/* CSV 버튼의 상단 노출은 제거하고 플로팅으로 이동 */}
                </Row>
                <Row>
                    <Col md="6">
                        <Card>
                            <Card.Body>
                                <div ref={mapRef} style={{height: "450px"}}/>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md="6">
                        <Card>
                            <Card.Header>
                                <Card.Title as="h4">월간 통계 <span
                                    style={{fontWeight: "bold"}}>{potholeCount + crackCount + solvedCount}건</span> <span
                                    style={{fontSize: "14px"}}>({roadMonth} 이후)</span></Card.Title>
                            </Card.Header>
                            <Card.Body>
                                <div
                                    className="ct-chart"
                                    id="chartPreferences"
                                    style={{height: "320px"}}
                                >
                                    {loading ? (
                                        <div style={{textAlign: "center", paddingTop: "100px"}}>
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="visually-hidden">Loading...</span>
                                            </div>
                                            <div>데이터 불러오는 중...</div>
                                        </div>
                                    ) : (
                                        <ChartistGraph
                                            data={{
                                                labels: [
                                                    `${potholePercent}%, ${potholeCount}건`,
                                                    `${crackPercent}%, ${crackCount}건`,
                                                    `${solvedPercent}%, ${solvedCount}건`
                                                ],
                                                series: [potholePercent, crackPercent, solvedPercent],
                                            }}
                                            type="Pie"
                                        />
                                    )}
                                </div>
                                <div className="legend">
                                    <i className="fas fa-circle text-info"></i>
                                    포트홀
                                    &nbsp;
                                    <i className="fas fa-circle text-danger"></i>
                                    크랙
                                    &nbsp;
                                    <i className="fas fa-circle text-warning"></i>
                                    해결된 파손
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
                <Row>
                    <Col md="12">
                        <Card>
                            <Card.Header>
                                <Card.Title as="h4">지역별 통계</Card.Title>
                            </Card.Header>
                            <Card.Body>
                                <div className="table-responsive">
                                    <table className="table">
                                        <thead className="text-primary">
                                        <tr>
                                            <th>지역</th>
                                            <th>도로파손</th>
                                            <th>지반침하 의심</th>
                                            <th>지하안전정보</th>
                                            <th>총계</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {regionalStats.combinedStats.map((stat, index) => (
                                            <tr key={index}>
                                                <td><strong>{stat.region}</strong></td>
                                                <td>
                                                    <span style={{
                                                        fontSize: "18px",
                                                        fontWeight: "bold",
                                                        color: "#198754"
                                                    }}>
                                                        {stat.roadCount}건
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{
                                                        fontSize: "18px",
                                                        fontWeight: "bold",
                                                        color: "#dc3545"
                                                    }}>
                                                        {stat.ggCount}건
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{
                                                        fontSize: "18px",
                                                        fontWeight: "bold",
                                                        color: "#0dcaf0"
                                                    }}>
                                                        {stat.ssCount}건
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{
                                                        fontSize: "20px",
                                                        fontWeight: "bold",
                                                        color: "#0d6efd"
                                                    }}>
                                                        {stat.total}건
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{marginTop: "15px", fontSize: "14px", color: "#666"}}>
                                    <i className="fas fa-circle text-success"></i> 도로파손 (roadreport) &nbsp;
                                    <i className="fas fa-circle text-danger"></i> 지반침하 의심 (ggdata) &nbsp;
                                    <i className="fas fa-circle text-info"></i> 지하안전정보 (ssdata)
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>
            {/* 플로팅 액션: CSV 버튼 + (관리자일 때) 데이터 전송 */}
            <div className="floating-actions">
                <div className="floating-csv">
                    <button className="floating-btn outline" onClick={exportStatsCSV} title="통계 CSV 다운로드" aria-label="통계 CSV 다운로드">
                        <i className="fas fa-download"></i>
                        <span>통계 다운로드</span>
                    </button>
                    <button className="floating-btn primary" onClick={exportRecordsCSV} title="상세 CSV 다운로드" aria-label="상세 CSV 다운로드">
                        <i className="fas fa-download"></i>
                        <span>상세 다운로드</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

// Error Boundary로 감싸진 AdminData 컴포넌트
function AdminDataWithErrorBoundary() {
    return (
        <AdminDataErrorBoundary>
            <AdminData />
        </AdminDataErrorBoundary>
    );
}

export default AdminDataWithErrorBoundary;
