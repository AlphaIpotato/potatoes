import React from "react";
import {useLocation, useNavigate, NavLink, Link} from "react-router-dom";
import {Nav} from "react-bootstrap";

function Sidebar({color, image, routes}) {
    const url = "http://192.168.0.146:8000";
    const location = useLocation();
    const navigate = useNavigate();

    const activeRoute = (routeName) => {
        return location.pathname.indexOf(routeName) > -1 ? "active" : "";
    };
    return (
        <div className="sidebar" data-image={image} data-color={color}>
            <div
                className="sidebar-background"
                style={{
                    backgroundImage: "url(" + image + ")"
                }}
            />
            <div className="sidebar-wrapper">
                <div className="logo d-flex align-items-center justify-content-center">
                    <Link to={`/dorosee/loader`} className="simple-text logo-mini mx-1">
                        <div className="logo-img d-flex align-items-center justify-content-center w-100">
                            Doro-See
                        </div>
                    </Link>
                </div>

                <Nav>
                    {routes.map((prop, key) => {
                        if (!prop.redirect)
                            return (
                                <li
                                    className={
                                        prop.upgrade
                                            ? "active active-pro"
                                            : activeRoute(prop.layout + prop.path)
                                    }
                                    key={key}
                                >
                                    <NavLink
                                        to={prop.layout + prop.path}
                                        className={({isActive}) => (isActive ? "nav-link active" : "nav-link")}
                                        onClick={async (e) => {
                                            e.preventDefault();
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
                                        }}
                                    >
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
