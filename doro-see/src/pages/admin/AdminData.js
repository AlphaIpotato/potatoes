import React, {useEffect, useRef, useState} from "react";
import {useLocation} from "react-router-dom";
import ChartistGraph from "react-chartist";
import {
    Card,
    Container,
    Row,
    Col,
} from "react-bootstrap";

function AdminData() {
    const location = useLocation();
    const road_data = location.state?.fetchedData || [];

    const filteredData = road_data.filter(road => road.roadreport_image);

    const naver = window.naver;
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (filteredData.length > 0) {
            setLoading(false);
        }
    }, [filteredData]);

    // 시간 형식 맞추기
    const road_date = new Date();
    const now_ymd = `${road_date.getFullYear()}-${(road_date.getMonth() + 1).toString().padStart(2, "0")}-${road_date.getDate().toString().padStart(2, "0")}`;

    const agoWeek = new Date(road_date);
    agoWeek.setDate(road_date.getDate() - 7);
    const roadWeek = road_date.getDate() < 8 ? (`${road_date.getFullYear()}-${(road_date.getMonth()).toString().padStart(2, "0")}-${agoWeek.getDate().toString().padStart(2, "0")}`) :
        (`${road_date.getFullYear()}-${(road_date.getMonth() + 1).toString().padStart(2, "0")}-${agoWeek.getDate().toString().padStart(2, "0")}`);

    const agoMonth = new Date(road_date);
    agoMonth.setDate(road_date.getDate() - 30);
    const roadMonth = `${road_date.getFullYear()}-${(agoMonth.getMonth() + 1).toString().padStart(2, "0")}-${agoMonth.getDate().toString().padStart(2, "0")}`;

    const monthData = filteredData.filter(
        (road) => road.ymd >= roadMonth
    );

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

    // 월별 통계 (원그래프)
    // 포트홀과 크랙이 동시에 있는 경우 포트홀로 분류함

    const potholeCount = monthData.filter(
        (road => (road.roadreport_damagetype.includes("pothole") && road.roadreport_status !== "해결됨"))).length;
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

    // 지도
    useEffect(() => {
        const map = new naver.maps.Map(mapRef.current, {
            center: new naver.maps.LatLng(36.193344, 127.934838),
            zoom: 7,
            minZoom: 7,
            zoomControl: true,
            zoomControlOptions: {
                position: naver.maps.Position.TOP_RIGHT,
            },
        });

        map.setOptions("mapTypeControl", true);
        naver.maps.Event.addListener(map, "zoom_changed", (zoom) => {
            // console.log("zoom:", zoom);
        });

        naver.maps.Event.once(map, "init", () => {
            console.log("지도 초기화 완료");
        });

        mapInstance.current = map;

        filteredData.forEach((road) => {
            if (road.roadreport_latlng) {
                const [lng, lat] = road.roadreport_latlng.split(",").map(coord => parseFloat(coord.trim()));

                if (road.roadreport_damagetype.includes("pothole")) {

                    new naver.maps.Marker({
                        position: new naver.maps.LatLng(lng, lat),
                        map: map,
                        icon: {
                            url: "/media/icon_pothole.png",
                            size: new naver.maps.Size(32, 32),
                            origin: new naver.maps.Point(0, 0),
                            anchor: new naver.maps.Point(16, 16)
                        }
                    });
                    // console.log(`좌표: ${lat}, ${lng}`);

                } else if (road.roadreport_damagetype.includes("crack")) {

                    new naver.maps.Marker({
                        position: new naver.maps.LatLng(lng, lat),
                        map: map,
                        icon: {
                            url: "/media/icon_crack.png",
                            size: new naver.maps.Size(32, 32),
                            origin: new naver.maps.Point(0, 0),
                            anchor: new naver.maps.Point(16, 16)
                        }
                    });

                    // console.log(`좌표: ${lat}, ${lng}`);
                } else {
                    console.log(`num ${road.roadreport_num} latlng 없음`);
                }
            }
        });


    }, [filteredData]);


    // 좌표로 지역 분류하기 (미구현됨)
    const classifyRegion = () => {
        naver.maps.Service.reverseGeocode({
            coords: new naver.maps.LatLng(37.3595316, 127.1052133),
        }, function (status, response) {
            if (status !== naver.maps.Service.Status.OK) {
                return console.log('Something wrong!', response);
            }
        });
    }

    classifyRegion();


    return (
        <>
            <Container fluid>
                <Row>
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
                {/*<Row>*/}
                {/*    <Col md="12">*/}
                {/*        <Card>*/}
                {/*            <Card.Header>*/}
                {/*                <Card.Title as="h4">지역별 통계</Card.Title>*/}
                {/*            </Card.Header>*/}
                {/*            <Card.Body>*/}
                {/*                <div className="ct-chart" id="chartActivity">*/}
                {/*                    <ChartistGraph*/}
                {/*                        data={{*/}
                {/*                            labels: [*/}
                {/*                                "서울",*/}
                {/*                                "경기",*/}
                {/*                                "인천",*/}
                {/*                                "강원",*/}
                {/*                                "충청",*/}
                {/*                                "전라",*/}
                {/*                                "경상",*/}
                {/*                                "대전",*/}
                {/*                                "대구",*/}
                {/*                                "부산",*/}
                {/*                                "광주",*/}
                {/*                                "울산",*/}
                {/*                                "제주",*/}
                {/*                            ],*/}
                {/*                            series: [*/}
                {/*                                [*/}
                {/*                                    542,*/}
                {/*                                    443,*/}
                {/*                                    320,*/}
                {/*                                    780,*/}
                {/*                                    553,*/}
                {/*                                    453,*/}
                {/*                                    326,*/}
                {/*                                    434,*/}
                {/*                                    568,*/}
                {/*                                    610,*/}
                {/*                                    756,*/}
                {/*                                    895,*/}
                {/*                                    895,*/}
                {/*                                ],*/}
                {/*                                [*/}
                {/*                                    412,*/}
                {/*                                    243,*/}
                {/*                                    280,*/}
                {/*                                    580,*/}
                {/*                                    453,*/}
                {/*                                    353,*/}
                {/*                                    300,*/}
                {/*                                    364,*/}
                {/*                                    368,*/}
                {/*                                    410,*/}
                {/*                                    636,*/}
                {/*                                    695,*/}
                {/*                                    695,*/}
                {/*                                ],*/}
                {/*                            ],*/}
                {/*                        }}*/}
                {/*                        type="Bar"*/}
                {/*                        options={{*/}
                {/*                            seriesBarDistance: 10,*/}
                {/*                            axisX: {*/}
                {/*                                showGrid: false,*/}
                {/*                            },*/}
                {/*                            height: "245px",*/}
                {/*                        }}*/}
                {/*                        responsiveOptions={[*/}
                {/*                            [*/}
                {/*                                "screen and (max-width: 640px)",*/}
                {/*                                {*/}
                {/*                                    seriesBarDistance: 5,*/}
                {/*                                    axisX: {*/}
                {/*                                        labelInterpolationFnc: function (value) {*/}
                {/*                                            return value[0];*/}
                {/*                                        },*/}
                {/*                                    },*/}
                {/*                                },*/}
                {/*                            ],*/}
                {/*                        ]}*/}
                {/*                    />*/}
                {/*                </div>*/}
                {/*            </Card.Body>*/}
                {/*            <Card.Footer>*/}
                {/*                <div className="legend">*/}
                {/*                    <i className="fas fa-circle text-info"></i>*/}
                {/*                    포트홀*/}
                {/*                    &nbsp;*/}
                {/*                    <i className="fas fa-circle text-danger"></i>*/}
                {/*                    크랙*/}
                {/*                </div>*/}
                {/*            </Card.Footer>*/}
                {/*        </Card>*/}
                {/*    </Col>*/}
                {/*</Row>*/}
            </Container>
        </>
    );
}

export default AdminData;
