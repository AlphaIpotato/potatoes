import AdminData from "./pages/admin/AdminData.js";
import AdminManage from "./pages/admin/AdminManage.js";
import UserProfile from "./pages/users/UserProfile.js";
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

    // user
    // {
    //     path: "/user/info",
    //     name: `회원이름`,
    //     icon: "nc-icon nc-circle-09",
    //     component: UserProfile,
    //     layout: "/dorosee",
    //     endpoint: `users/info/${user_id}/`
    // },
];

export default App;
