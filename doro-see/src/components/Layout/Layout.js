import React from "react";
import {useLocation, Route, Outlet} from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import MobileTabBar from "./MobileTabBar";
import routes from "../../App.js";
import sidebarImage from "../../assets/img/sidebar-3.jpg";

function Layout() {
    // const [image, setImage] = React.useState(sidebarImage);
    const [color, setColor] = React.useState("black");
    const location = useLocation();
    const mainPanel = React.useRef(null);

    const noPaddingPaths = [
        "/dorosee",
        "/dorosee/direction"
    ];

    const isMap = noPaddingPaths.includes(location.pathname);

    React.useEffect(() => {
        document.documentElement.scrollTop = 0;
        document.scrollingElement.scrollTop = 0;
        mainPanel.current.scrollTop = 0;
        if (
            window.innerWidth < 993 &&
            document.documentElement.className.indexOf("nav-open") !== -1
        ) {
            document.documentElement.classList.toggle("nav-open");
            var element = document.getElementById("bodyClick");
            element.parentNode.removeChild(element);
        }
    }, [location]);

    return (
        <div className="app-shell">
            <div className="app-content" ref={mainPanel}>
                {!isMap && <Header/>}
                <div className={`content ${isMap ? "no-padding" : ""}`}>
                    <Outlet/>
                </div>
            </div>
            <MobileTabBar/>
        </div>
    );
}

export default Layout;
