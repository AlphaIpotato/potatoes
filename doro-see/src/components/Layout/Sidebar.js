import React from "react";
import {useLocation, useNavigate, NavLink, Link} from "react-router-dom";
import {Nav} from "react-bootstrap";

function Sidebar({color, image, routes}) {
    const url = "http://10.120.193.236:8000";
    const location = useLocation();
    const navigate = useNavigate();
    
    // 로그인 상태 및 권한 확인
    const user_id = sessionStorage.getItem('user_id');
    const user_role = sessionStorage.getItem('user_role');
    const isLoggedIn = !!user_id;
    const isAdmin = user_role === 'admin';

    const activeRoute = (routeName) => {
        return location.pathname.indexOf(routeName) > -1 ? "active" : "";
    };

    // 권한에 따른 메뉴 필터링
    const filterRoutesByPermission = (route) => {
        // 관리자 페이지는 로그인된 관리자만 볼 수 있음
        if (route.path.includes('/admin/')) {
            return isLoggedIn && isAdmin;
        }
        
        // 사용자 페이지는 로그인된 일반 사용자만 볼 수 있음 (관리자 제외)
        if (route.path.includes('/user/') && route.path !== '/user/auth' && route.path !== '/user/logout') {
            return isLoggedIn && !isAdmin;
        }
        
        // 로그아웃은 로그인된 사용자만 볼 수 있음
        if (route.path === '/user/logout') {
            return isLoggedIn;
        }
        
        // 로그인 페이지는 비로그인 상태에서만 표시
        if (route.path === '/user/auth') {
            return !isLoggedIn;
        }
        
        // 길찾기는 항상 표시
        return true;
    };

    // 로그아웃 처리
    const handleLogout = () => {
        sessionStorage.removeItem('user_id');
        sessionStorage.removeItem('user_role');
        sessionStorage.removeItem('user_name');
        navigate('/dorosee/user/auth');
        window.location.reload(); // 사이드바 재렌더링을 위해
    };
    return (
        <div className="sidebar" data-image={image} data-color={color}>
            <div
                className="sidebar-background"
                style={{
                    backgroundImage: "url(" + image + ")"
                }}/>
            <div className="sidebar-wrapper">
                <div className="logo d-flex align-items-center justify-content-center">
                    <Link to={`/dorosee/loader`} className="simple-text logo-mini mx-1">
                        <div className="logo-img d-flex align-items-center justify-content-center w-100">
                            Doro-See
                        </div>
                    </Link>
                </div>

                <Nav>
                    {routes.filter(filterRoutesByPermission).map((prop, key) => {
                        if (!prop.redirect)
                            return (
                                <li
                                    className={
                                        prop.upgrade
                                            ? "active active-pro"
                                            : activeRoute(prop.layout + prop.path)
                                    }
                                    key={key}>

                                    <NavLink
                                        to={prop.layout + prop.path}
                                        className={({isActive}) => (isActive ? "nav-link active" : "nav-link")}
                                        onClick={async (e) => {
                                            e.preventDefault();
                                            
                                            // 로그아웃 처리
                                            if (prop.logout) {
                                                handleLogout();
                                                return;
                                            }
                                            
                                            try {
                                                const response = await fetch(`${url}/${prop.endpoint}`, {
                                                    method: "GET",
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                    },
                                                });

                                                if (response.ok) {
                                                    const data = await response.json();
                                                    console.log("데이터 수신:", data);
                                                    navigate(prop.layout + prop.path, {state: {fetchedData: data}});
                                                } else {
                                                    console.error("요청 실패:", response.statusText);
                                                    navigate(prop.layout + prop.path);
                                                }
                                            } catch (error) {
                                                console.error("요청 중 오류 발생:", error);
                                                navigate(prop.layout + prop.path);
                                            }
                                        }}>
                                        <i className={prop.icon}/>
                                        <p>{prop.name}</p>
                                    </NavLink>
                                </li>
                            );
                        return null;
                    })}
                </Nav>
            </div>
        </div>
    );
}

export default Sidebar;
