import React from "react";
import ReactDOM from "react-dom/client";

import {BrowserRouter, Route, Routes, Navigate} from "react-router-dom";

import "bootstrap/dist/css/bootstrap.min.css";
import "./assets/styles/animate.min.css";
import "./assets/scss/light-bootstrap-dashboard-react.scss?v=2.0.0";
import "./assets/styles/demo.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./assets/styles/mobile-app.css";

import DoroseeLoader from "./pages/DoroseeLoader";
import Layout from "./components/Layout/Layout.js";

import DamageMap from "./pages/DamageMap";
import Direction from "./pages/navi/Direction";

import AdminData from "./pages/admin/AdminData";
import AdminManage from "./pages/admin/AdminManage";

import UserManage from "./pages/users/UserManage";
import UserAuth from "./pages/users/UserAuth";
import UserLogin from "./pages/users/UserLogin";
import UserRegister from "./pages/users/UserRegister";
import UserFindAccount from "./pages/users/UserFindAccount";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<DoroseeLoader />}/>

            <Route path="/dorosee" element={<Layout/>}>
                <Route path="loader" element={<DoroseeLoader />}/>

                <Route path="" element={<DamageMap/>}/>
                <Route path="direction" element={<Direction/>}/>

                <Route path="admin/data" element={<AdminData/>}/>
                <Route path="admin/manage" element={<AdminManage/>}/>
                <Route path="user/auth" element={<UserAuth/>}/>

                <Route path="user/login" element={<UserLogin/>}/>
                <Route path="user/register" element={<UserRegister/>}/>
                <Route path="user/info" element={<UserManage/>}/>
                <Route path="user/findaccount" element={<UserFindAccount/>}/>
            </Route>
        </Routes>
    </BrowserRouter>
);
