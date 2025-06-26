import React, {useEffect, useRef, useState} from "react";
import {Card, Table, Container, Row, Col, Dropdown} from "react-bootstrap";
import {useLocation} from "react-router-dom";

function AdminManage() {
    const url = "http://192.168.0.146:8000";
    const location = useLocation();
    const receivedData = location.state?.fetchedData || [];

    const filteredData = receivedData.filter(road => road.roadreport_image);

    const naver = window.naver;
    const mapRef = useRef(null);
    const mapInstance = useRef(null);

    const processedData = processRoadData(receivedData);
    const [road_manage, setRoadManage] = useState(processedData);


    function processRoadData(data) {
        return data.map(road => {
            if (road.roadreport_latlng) {
                const [lat, lng] = road.roadreport_latlng.split(",");
                road.lat = lat;
                road.lng = lng;
            }

            if (road.roadreport_time) {
                const [ymd, hms] = road.roadreport_time.split("T");
                road.ymd = ymd;
                road.hms = hms;
            }

            return road;
        });
    }


    const perPage = 10;
    const pagesPerGroup = 10;
    const [currentPage, setPage] = useState(1);

    const [selectedDamageFilter, setSelectedDamageFilter] = useState("전체");
    const [selectedStateFilter, setSelectedStateFilter] = useState("전체");

    const appliedfilterData = road_manage.filter((road) => {
        const matchDamage = selectedDamageFilter === "전체" || road.roadreport_damagetype.includes(selectedDamageFilter);
        const matchState = selectedStateFilter === "전체" || road.roadreport_status.includes(selectedStateFilter);
        const excludeResolved = selectedStateFilter === "전체" ? road.roadreport_status !== "해결됨" : matchState;
        return road.roadreport_image && (road.roadreport_count >= 3) && excludeResolved && matchDamage && matchState;
    });

    const totalPages = Math.ceil(appliedfilterData.length / perPage);
    const totalGroups = Math.ceil(totalPages / pagesPerGroup);
    const currentGroup = Math.ceil(currentPage / pagesPerGroup);

    const groupStartPage = (currentGroup - 1) * pagesPerGroup + 1;
    const groupEndPage = Math.min(currentGroup * pagesPerGroup, totalPages);
    const startIndex = (currentPage - 1) * perPage;

    const currentData = appliedfilterData.slice(startIndex, startIndex + perPage);
    const changePage = (page) => {
        setPage(page);
    };

    const goToPrevGroup = () => {
        if (currentGroup === 1) return;
        const prevGroupStartPage = (currentGroup - 2) * pagesPerGroup + 1;
        setPage(prevGroupStartPage);
    };

    const goToNextGroup = () => {
        if (currentGroup === totalGroups) return;
        const nextGroupStartPage = currentGroup * pagesPerGroup + 1;
        setPage(nextGroupStartPage);
    };

    const [isImageOpen, setIsImageOpen] = useState(false);
    const [isLocationOpen, setIsLocationOpen] = useState(false);

    const [modalImage, setModalImage] = useState("");
    const [modalLocation, setModalLocation] = useState("");

    const openImageModal = (image) => {
        setModalImage(image);
        setIsImageOpen(true);
    };

    const openLocationModal = (damageLocation) => {
        setModalLocation(damageLocation);
        setIsLocationOpen(true);
    };

    const closeImage = () => {
        setIsImageOpen(false);
    };
    const closeLocation = () => {
        setIsLocationOpen(false);
    };

    const handleDamageFilter = (e) => {
        setSelectedDamageFilter(e.target.value);
    };

    const handleStateFilter = (e) => {
        setSelectedStateFilter(e.target.value);
    };

    const status_options = [
        {value: '접수됨', label: '접수됨'},
        {value: '처리중', label: '처리중'},
        {value: '해결됨', label: '해결됨'},
        {value: '보류중', label: '보류중'},
    ];

    const damageFilter = [
        {value: '전체', label: '전체'},
        {value: 'pothole', label: 'pothole'},
        {value: 'crack', label: 'crack'},
    ];

    const stateFilter = [
        {value: '전체', label: '전체'},
        {value: '접수됨', label: '접수됨'},
        {value: '처리중', label: '처리중'},
        {value: '해결됨', label: '해결됨'},
        {value: '보류중', label: '보류중'},
    ];

    async function updateState(roadreport_num, state) {
        try {
            const response = await fetch(`${url}/roadreport/edit/${roadreport_num}/`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roadreport_status: state
                }),
            });

            const result = await response.json();

            if (response.ok) {
                const updatedRoadManage = await fetchUpdatedData();
                setRoadManage(updatedRoadManage);
                console.log('roadreport/edit:', result);

            } else {
                console.error('roadreport/edit error:', response.status, result);
            }

            return result;

        } catch (error) {
            console.error(`roadreport/edit error/${roadreport_num} :`, error);
            return null;
        }
    }

    async function deleteRoadData(roadreport_num) {
        try {
            const response = await fetch(`${url}/roadreport/delete/${roadreport_num}/`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.text();

            if (response.ok) {
                const deleteRoadManage = await fetchUpdatedData();
                setRoadManage(deleteRoadManage);
                console.log('roadreport/delete:', result);

            } else {
                console.error('roadreport/delete error:', response.status, result);
            }

            return result;

        } catch (error) {
            console.error(`roadreport/delete error/${roadreport_num} :`, error);
            return null;
        }
    }

    // API 재호출
    const fetchUpdatedData = async () => {
        try {
            const response = await fetch(`${url}/roadreport/all`);
            if (response.ok) {
                const data = await response.json();
                return processRoadData(data);
            } else {
                console.error('Failed to fetch updated data');
                return [];
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            return [];
        }
    };


    // 5초마다 데이터 갱신
    useEffect(() => {
        const interval = setInterval(async () => {
            const updatedData = await fetchUpdatedData();
            setRoadManage(updatedData);
            console.log("데이터 갱신됨");
        }, 5000);

        return () => clearInterval(interval);
    }, []);


    // 지도
    useEffect(() => {
        if (!mapRef.current) return;

        const map = new naver.maps.Map(mapRef.current, {
            center: new naver.maps.LatLng(36.193344, 127.934838),
            zoom: 16,
            minZoom: 7,
            zoomControl: true,
            zoomControlOptions: {
                position: naver.maps.Position.TOP_RIGHT,
            },
        });

        naver.maps.Event.once(map, "init", () => {
            console.log("지도 초기화 완료");
        });

        mapInstance.current = map;

        appliedfilterData.forEach((road) => {
            if (road.roadreport_latlng) {
                const [lng, lat] = road.roadreport_latlng.split(",").map(coord => parseFloat(coord.trim()));

                const iconType = road.roadreport_damagetype.includes("pothole")
                    ? "/media/icon_pothole.png"
                    : "/media/icon_crack.png";

                new naver.maps.Marker({
                    position: new naver.maps.LatLng(lng, lat),
                    map: map,
                    icon: {
                        url: iconType,
                        size: new naver.maps.Size(32, 32),
                        origin: new naver.maps.Point(0, 0),
                        anchor: new naver.maps.Point(16, 16)
                    }
                });
            }
        });
    }, [filteredData]);

    useEffect(() => {
        if (isLocationOpen && modalLocation && mapInstance.current) {
            const [lat, lng] = modalLocation.split(',').map(coord => parseFloat(coord.trim()));
            const location = new naver.maps.LatLng(lat, lng);

            mapInstance.current.setCenter(location);
        }
    }, [isLocationOpen, modalLocation]);


    return (
        <>
            <Container fluid>
                <Row>
                    <Col md="12">
                        <Card className="strpied-tabled-with-hover">
                            <Card.Header>
                                <div style={{display: 'flex', alignItems: 'center'}}>
                                    <Card.Title as="h4" style={{marginRight: '10px'}}>도로 파손 데이터</Card.Title>
                                    <div style={{display: 'flex', gap: '10px'}}>
                                        <Dropdown>
                                            <div>&nbsp;파손 유형</div>
                                            <Dropdown.Toggle variant="success" id="damage-filter-dropdown"
                                                             style={{
                                                                 color: "black",
                                                                 border: "1px solid black"
                                                             }}>
                                                {selectedDamageFilter}
                                            </Dropdown.Toggle>
                                            <Dropdown.Menu>
                                                {damageFilter.map((option) => (
                                                    <Dropdown.Item key={option.value}
                                                                   onClick={() => handleDamageFilter({target: {value: option.value}})}>
                                                        {option.label}
                                                    </Dropdown.Item>
                                                ))}
                                            </Dropdown.Menu>
                                        </Dropdown>
                                        <Dropdown>
                                            <div style={{}}>&nbsp;처리 상태</div>
                                            <Dropdown.Toggle variant="success" id="state-filter-dropdown"
                                                             style={{
                                                                 color: "black",
                                                                 border: "1px solid black"
                                                             }}>
                                                {selectedStateFilter}
                                            </Dropdown.Toggle>
                                            <Dropdown.Menu>
                                                {stateFilter.map((option) => (
                                                    <Dropdown.Item key={option.value}
                                                                   onClick={() => handleStateFilter({target: {value: option.value}})}>
                                                        {option.label}
                                                    </Dropdown.Item>
                                                ))}
                                            </Dropdown.Menu>
                                        </Dropdown>
                                    </div>
                                </div>
                            </Card.Header>

                            <Card.Body className="table-full-width table-responsive px-0">

                                <Table className="table-hover table-striped">
                                    <thead>
                                    <tr>
                                        <th className="border-0">번호</th>
                                        <th className="border-0">위도, 경도</th>
                                        <th className="border-0">사진</th>
                                        <th className="border-0">파손 유형</th>
                                        <th className="border-0">처리 상태</th>
                                        <th className="border-0">시간</th>
                                        <th className="border-0">빈도</th>
                                        <th className="border-0">e.t.c</th>
                                    </tr>
                                    </thead>
                                    <tbody style={{
                                        margin: "0",
                                        padding: "0"
                                    }}>
                                    {currentData.slice()
                                        .map((road, index) => (
                                            <tr key={index}>
                                                <td className="num">{road.roadreport_num}</td>
                                                <td className="id">위도: {road.lat}<br/>경도: {road.lng}</td>
                                                <td className="image">
                                                    <img
                                                        src={`${url}${road.roadreport_image}`}
                                                        onError={(e) => {
                                                            e.target.onerror = null;
                                                            e.target.src = 'http://localhost:3000/media/default-fallback-image.png';
                                                        }}
                                                        style={{
                                                            maxWidth: "60px",
                                                        }}
                                                        alt={`img${startIndex + index}`}
                                                        className="clickable-image"
                                                        onClick={() => openImageModal(`${url}/${road.roadreport_image}`)}
                                                    />
                                                </td>
                                                <td className="damage_type">{road.roadreport_damagetype}</td>
                                                <td className="status">
                                                    <Dropdown>
                                                        <Dropdown.Toggle variant="success"
                                                                         id="status-dropdown"
                                                                         style={{
                                                                             color: "black",
                                                                             border: "1px solid black"
                                                                         }}>
                                                            {road.roadreport_status}
                                                        </Dropdown.Toggle>
                                                        <Dropdown.Menu>
                                                            {status_options.map((status) => (
                                                                <Dropdown.Item key={status.value}
                                                                               disabled={road.roadreport_status === status.value}
                                                                               onClick={() => updateState(road.roadreport_num, status.value)}>
                                                                    {status.label}
                                                                </Dropdown.Item>
                                                            ))}
                                                        </Dropdown.Menu>
                                                    </Dropdown>
                                                </td>
                                                <td className="time">{road.ymd + " " + road.hms}</td>
                                                <td className="count">{road.roadreport_count}</td>
                                                <td className="edit">
                                                    <button
                                                        onClick={(() => openLocationModal(road.roadreport_latlng))}>위치
                                                    </button>
                                                    <button onClick={() => deleteRoadData(road.roadreport_num)}>삭제
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col>
                        {/* 페이지네이션 */}
                        <div className="pagination"
                             style={{display: 'flex', justifyContent: 'center', marginTop: '20px'}}>
                            <button onClick={goToPrevGroup} disabled={currentGroup === 1}>&lt;</button>
                            {
                                Array.from({length: groupEndPage - groupStartPage + 1}, (_, index) => {
                                    const pageNumber = groupStartPage + index;
                                    return (
                                        <button
                                            key={pageNumber}
                                            className={`page_button ${currentPage === pageNumber ? 'active' : ''}`}
                                            onClick={() => changePage(pageNumber)}
                                        >
                                            {pageNumber}
                                        </button>
                                    );
                                })
                            }
                            <button onClick={goToNextGroup} disabled={currentGroup === totalGroups}>&gt;</button>
                        </div>
                    </Col>
                </Row>
            </Container>

            {/* 이미지 모달 */}
            {isImageOpen && (
                <div className="modal-background" onClick={closeImage}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={closeImage}>X</button>
                        <img src={modalImage}
                             onError={(e) => {
                                 e.target.onerror = null;
                                 e.target.src = 'http://localhost:3000/media/default-fallback-image.png';
                             }}
                             alt={`img${startIndex + currentPage}`} className="modal-item"/>
                    </div>
                </div>
            )}

            {/* 위치 모달 */}
            {isLocationOpen && (
                <div className="modal-background" onClick={closeLocation}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={closeLocation}>X</button>
                        <div ref={mapRef} style={{height: "450px"}}/>
                    </div>
                </div>
            )}
        </>
    );
}

export default AdminManage;
