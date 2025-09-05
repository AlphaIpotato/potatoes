import AdminData from "./pages/admin/AdminData.js";
import AdminManage from "./pages/admin/AdminManage.js";
import UserManage from "./pages/users/UserManage.js";
import UserAuth from "./pages/users/UserAuth.js";
import Direction from "./pages/navi/Direction";

const user_id = sessionStorage.getItem(`user_id`)
console.log("user_id", user_id);

const App = [

    // navi
    {
        path: "/direction",
        name: "길찾기",
        icon: "nc-icon nc-pin-3",
        component: Direction,
        layout: "/dorosee",
        endpoint: "roadreport/all"

    },

    // admin
    {
        path: "/admin/data",
        name: "파손 통계",
        icon: "nc-icon nc-chart-pie-35",
        component: AdminData,
        layout: "/dorosee",
        endpoint: "roadreport/all"
    },
    {
        path: "/admin/manage",
        name: "파손 관리",
        icon: "nc-icon nc-notes",
        component: AdminManage,
        layout: "/dorosee",
        endpoint: "roadreport/all"
    },
    {
        path: "/user/auth",
        name: "로그인",
        icon: "nc-icon nc-circle-09",
        component: UserAuth,
        layout: "/dorosee",
        endpoint: ""
    },

    // user
    {
        path: "/user/info",
        name: "내 신고 내역",
        icon: "nc-icon nc-paper-2",
        component: UserManage,
        layout: "/dorosee",
        endpoint: `roadreport/my`
    },
    {
        path: "/user/logout",
        name: "로그아웃",
        icon: "nc-icon nc-button-power",
        component: null,
        layout: "/dorosee",
        endpoint: "",
        logout: true
    },
];

export default App;
