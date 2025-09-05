import React from "react";
import {Link, useLocation} from "react-router-dom";
import {Container, Dropdown} from "react-bootstrap";
import routes from "../../App.js";
import SearchPlaceBar from "../SearchPlaceBar";
import PiServerControl from "../PiServerControl";

function Header() {
    const location = useLocation();

    const getBrandText = () => {
        for (let i = 0; i < routes.length; i++) {
            if (location.pathname.indexOf(routes[i].layout + routes[i].path) !== -1) {
                return routes[i].name;
            }
        }
        return "파손 지도";
    };

    const showSearchBar = location.pathname.includes("direction");
    const auth = (() => { try { return JSON.parse(localStorage.getItem("dorosee_auth")); } catch(_) { return null; } })();
    const isAdmin = auth?.role === "admin";
    const showLaPaControl = location.pathname.includes("admin") && isAdmin;
    const showUserData = sessionStorage.getItem('user_id');

    return (
        <header className="p-3 mb-0 border-bottom">
            <Container fluid>
                <div className="d-flex justify-content-between align-items-center">
                    {/* 왼쪽: 로고 + 네비게이션 메뉴 */}
                    <div className="d-flex align-items-center gap-4">
                        {/* 로고 */}
                        <div style={{fontWeight: "bold", color: "black", fontSize: "18px"}}>
                            {getBrandText()}
                        </div>
                    </div>

                    {/* 오른쪽: 검색창 + 프로필 드롭다운 */}
                    <div className="d-flex align-items-center gap-3 ms-auto">

                        {/* 조건에 맞으면 검색창 보이기 */}
                        {showSearchBar && <SearchPlaceBar/>}
                        {showLaPaControl && <PiServerControl/>}
                        &emsp;

                        {/* 프로필 드롭다운 */}
                        {showUserData === null ? (
                            <div>
                                {/*<Link to={`/dorosee/user/login`}>로그인</Link>*/}

                            </div>
                        ) : (
                            <Dropdown align="end" className="text-end">
                                <Dropdown.Toggle variant="link"
                                                 className="d-block link-body-emphasis text-decoration-none p-0 border-0">
                                    <img src="https://github.com/mdo.png" alt="mdo" width="32" height="32"
                                         className="rounded-circle"/>
                                </Dropdown.Toggle>

                                <Dropdown.Menu className="text-small">
                                    <Dropdown.Item href="#">New project...</Dropdown.Item>
                                    <Dropdown.Item href="#">Settings</Dropdown.Item>
                                    <Dropdown.Item href="#">Profile</Dropdown.Item>
                                    <Dropdown.Divider/>
                                    <Dropdown.Item href="#">Sign out</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        )}

                    </div>
                </div>
            </Container>
        </header>
    );
}

export default Header;
