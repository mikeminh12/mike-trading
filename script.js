// === Firebase Config ===
const firebaseConfig = {
    apiKey: "AIzaSyANI-NhTbl8R20twhekpnXtzZvmkOLqP24",
    authDomain: "miketrading-3b86a.firebaseapp.com",
    databaseURL: "https://miketrading-3b86a-default-rtdb.firebaseio.com",
    projectId: "miketrading-3b86a",
    storageBucket: "miketrading-3b86a.appspot.com",
    messagingSenderId: "692740435477",
    appId: "1:692740435477:web:e9b9a3696b87eef187e81c",
    measurementId: "G-3NX2TKD3NK"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentUID = null;
let currentPrice = 0;
let userListener = null;

// === Hiển thị thông báo nổi ===
function showNotification(message) {
    const box = document.createElement("div");
    box.className = "notification";
    box.innerText = message;
    document.getElementById("notifications").appendChild(box);
    setTimeout(() => box.remove(), 5000);
}

// === Đăng ký ===
function register() {
    const username = document.getElementById("usernameInput").value.trim();
    const password = document.getElementById("passwordInput").value.trim();

    if (!username || !password) return alert("Nhập username và mật khẩu!");

    db.ref("users").orderByChild("username").equalTo(username).once("value")
    .then(snapshot => {
        if (snapshot.exists()) {
            alert("Username đã tồn tại!");
        } else {
            const uid = db.ref("users").push().key;
            db.ref("users/" + uid).set({
                username,
                password: btoa(password),
                balanceUSD: 1000,
                mCoinAmount: 0
            }).then(() => {
                currentUID = uid;
                alert("Đăng ký thành công!");
                showDashboard(uid);
            });
        }
    });
}

// === Đăng nhập ===
function login() {
    const username = document.getElementById("usernameInput").value.trim();
    const password = document.getElementById("passwordInput").value.trim();

    if (!username || !password) return alert("Nhập username và mật khẩu!");

    db.ref("users").orderByChild("username").equalTo(username).once("value")
    .then(snapshot => {
        if (!snapshot.exists()) return alert("Username không tồn tại!");

        const data = snapshot.val();
        const uid = Object.keys(data)[0];
        const user = data[uid];

        if (user.password === btoa(password)) {
            currentUID = uid;
            showDashboard(uid);
        } else {
            alert("Sai mật khẩu!");
        }
    });
}

// === Đăng xuất ===
function logout() {
    if (userListener) db.ref("users/" + currentUID).off("value", userListener);
    currentUID = null;
    document.getElementById("auth").style.display = "block";
    document.getElementById("dashboard").style.display = "none";
}

// === Hiển thị dashboard ===
function showDashboard(uid) {
    document.getElementById("auth").style.display = "none";
    document.getElementById("dashboard").style.display = "block";

    // Lắng nghe dữ liệu user hiện tại realtime
    userListener = db.ref("users/" + uid).on("value", snap => {
        const data = snap.val();
        if (data) {
            document.getElementById("username").innerText = data.username;
            document.getElementById("balanceUSD").innerText = data.balanceUSD.toFixed(2);
            document.getElementById("mCoinAmount").innerText = data.mCoinAmount.toFixed(2);
        }
    });

    // Lắng nghe giá mCoin realtime
    db.ref("market/mCoin").on("value", snap => {
        const data = snap.val();
        if (data) {
            currentPrice = data.price;
            document.getElementById("mCoinPrice").innerText = data.price.toFixed(2);

            const history = data.history || [];
            priceChart.data.labels = history.map((_, i) => i + 1);
            priceChart.data.datasets[0].data = history;
            priceChart.update();
        }
    });

    // Hiển thị danh sách user realtime
    listenUserList();
}

// === Hiển thị danh sách user realtime ===
function listenUserList() {
    const tbody = document.getElementById("userListBody");

    db.ref("users").on("value", (snapshot) => {
        tbody.innerHTML = "";

        if (!snapshot.exists()) {
            tbody.innerHTML = `<tr><td colspan="4">Chưa có người dùng nào!</td></tr>`;
            return;
        }

        snapshot.forEach((child) => {
            const user = child.val();
            const totalAsset = user.balanceUSD + user.mCoinAmount * currentPrice;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${user.username}</td>
                <td>$${user.balanceUSD.toFixed(2)}</td>
                <td>${user.mCoinAmount.toFixed(2)}</td>
                <td>$${totalAsset.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    });
}

// === Mua mCoin ===
function buyMCoin() {
    const amount = parseFloat(document.getElementById("tradeAmount").value);
    if (amount <= 0) return alert("Nhập số hợp lệ!");

    db.ref("users/" + currentUID).once("value").then(userSnap => {
        const user = userSnap.val();
        const totalCost = amount * currentPrice;

        if (user.balanceUSD >= totalCost) {
            db.ref("users/" + currentUID).update({
                balanceUSD: user.balanceUSD - totalCost,
                mCoinAmount: user.mCoinAmount + amount
            });
            showNotification(`${user.username} vừa mua ${amount} mCoin!`);
        } else {
            alert("Không đủ USD!");
        }
    });
}

// === Bán mCoin ===
function sellMCoin() {
    const amount = parseFloat(document.getElementById("tradeAmount").value);
    if (amount <= 0) return alert("Nhập số hợp lệ!");

    db.ref("users/" + currentUID).once("value").then(userSnap => {
        const user = userSnap.val();

        if (user.mCoinAmount >= amount) {
            db.ref("users/" + currentUID).update({
                balanceUSD: user.balanceUSD + amount * currentPrice,
                mCoinAmount: user.mCoinAmount - amount
            });
            showNotification(`${user.username} vừa bán ${amount} mCoin!`);
        } else {
            alert("Không đủ mCoin!");
        }
    });
}

// === Tự tạo market nếu chưa có ===
function startPriceSimulator() {
    const marketRef = db.ref("market/mCoin");
    marketRef.once("value").then(snap => {
        if (!snap.exists()) {
            marketRef.set({ price: 50, history: [50] });
        }
    });

    setInterval(() => {
        marketRef.once("value").then(snap => {
            let price = snap.val().price;
            let history = snap.val().history || [];

            const fluctuation = (Math.random() - 0.5) * 2;
            price = Math.max(1, price + fluctuation);
            history.push(price);
            if (history.length > 50) history.shift();

            marketRef.update({ price, history });
        });
    }, 5000);
}

// === Chart.js ===
const ctx = document.getElementById("priceChart").getContext("2d");
const priceChart = new Chart(ctx, {
    type: "line",
    data: {
        labels: [],
        datasets: [{
            label: "mCoin Price",
            data: [],
            borderColor: "rgb(75, 192, 192)",
            tension: 0.1
        }]
    },
    options: { responsive: true }
});

// === Khởi động mô phỏng giá ===
startPriceSimulator();
