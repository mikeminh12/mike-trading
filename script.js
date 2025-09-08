// Firebase config
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
let currentPrice = 50;
const usersMap = {};
let listenersInitialized = false;

// Chart setup
const ctx = document.getElementById('priceChart').getContext('2d');
const priceChart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'mCoin Price', data: [], borderColor: 'rgb(75, 192, 192)', tension: 0.2 }] },
    options: { responsive: true }
});

// Đăng ký user mới
function register() {
    const username = document.getElementById('usernameInput').value.trim();
    if(!username) return alert("Nhập username!");

    const uid = db.ref('users').push().key;
    db.ref('users/' + uid).set({
        username,
        balanceUSD: 1000,
        mCoinAmount: 0
    }).then(() => {
        alert("Đăng ký thành công!");
        showDashboard(uid);
    });
}

// Đăng nhập (tìm user theo username)
function login() {
    const username = document.getElementById('usernameInput').value.trim();
    if(!username) return alert("Nhập username!");

    db.ref('users').orderByChild('username').equalTo(username).once('value').then(snap => {
        if(snap.exists()){
            const uid = Object.keys(snap.val())[0];
            showDashboard(uid);
        } else {
            alert("Username không tồn tại!");
        }
    });
}

function logout() {
    currentUID = null;
    document.getElementById('auth').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
}

// Render bảng xếp hạng
function renderLeaderboard() {
    const arr = Object.keys(usersMap).map(uid => {
        const u = usersMap[uid];
        const usd = Number(u.balanceUSD) || 0;
        const m = Number(u.mCoinAmount) || 0;
        const asset = usd + m * currentPrice;
        return { username: u.username, asset };
    });
    arr.sort((a,b) => b.asset - a.asset);
    const body = document.getElementById('leaderboardBody');
    let html = '';
    arr.forEach((u, i) => {
        html += `<tr>
            <td>${i+1}</td>
            <td>${u.username}</td>
            <td>$${u.asset.toFixed(2)}</td>
        </tr>`;
    });
    body.innerHTML = html;
}

// Toast thông báo
function showToast(msg) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 50);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 5000);
}

function pushNotification(msg) {
    db.ref('notifications').push().set(msg);
    showToast(msg);
}
db.ref('notifications').on('child_added', snap => {
    const msg = snap.val();
    if(msg) showToast(msg);
});

// Khởi tạo listener
function initGlobalListeners() {
    if (listenersInitialized) return;
    listenersInitialized = true;

    // Giá mCoin realtime
    db.ref('market/mCoin').on('value', snap => {
        const data = snap.val();
        currentPrice = data.price;
        document.getElementById('mCoinPrice').innerText = currentPrice.toFixed(2);
        const history = data.history || [];
        priceChart.data.labels = history.map((_, i) => i + 1);
        priceChart.data.datasets[0].data = history;
        priceChart.update();
        renderLeaderboard();
    });

    // Users realtime
    const usersRef = db.ref('users');
    usersRef.on('child_added', s => { usersMap[s.key] = s.val(); renderLeaderboard(); });
    usersRef.on('child_changed', s => { usersMap[s.key] = s.val(); renderLeaderboard(); });
    usersRef.on('child_removed', s => { delete usersMap[s.key]; renderLeaderboard(); });
}

function showDashboard(uid) {
    currentUID = uid;
    document.getElementById('auth').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    initGlobalListeners();
    db.ref('users/' + uid).on('value', snap => {
        const data = snap.val();
        document.getElementById('username').innerText = data.username;
        document.getElementById('balanceUSD').innerText = data.balanceUSD.toFixed(2);
        document.getElementById('mCoinAmount').innerText = data.mCoinAmount.toFixed(2);
    });
}

// Mua mCoin — dùng transaction an toàn
function buyMCoin() {
    const amount = parseFloat(document.getElementById('tradeAmount').value);
    if(!amount || amount <= 0) return alert("Nhập số hợp lệ!");

    db.ref('market/mCoin/price').once('value').then(snap => {
        const price = snap.val();
        db.ref('users/' + currentUID).transaction(user => {
            if(user){
                const cost = amount * price;
                if(user.balanceUSD >= cost){
                    user.balanceUSD -= cost;
                    user.mCoinAmount += amount;
                    pushNotification(`${user.username} vừa mua ${amount} mCoin 💸`);
                }
            }
            return user;
        });
    });
}

// Bán mCoin — dùng transaction an toàn
function sellMCoin() {
    const amount = parseFloat(document.getElementById('tradeAmount').value);
    if(!amount || amount <= 0) return alert("Nhập số hợp lệ!");

    db.ref('market/mCoin/price').once('value').then(snap => {
        const price = snap.val();
        db.ref('users/' + currentUID).transaction(user => {
            if(user){
                if(user.mCoinAmount >= amount){
                    user.mCoinAmount -= amount;
                    user.balanceUSD += amount * price;
                    pushNotification(`${user.username} vừa bán ${amount} mCoin 💰`);
                }
            }
            return user;
        });
    });
}

// Giả lập giá mCoin
function startPriceSimulator() {
    const marketRef = db.ref('market/mCoin');
    marketRef.once('value').then(snap => {
        if(!snap.exists()){
            marketRef.set({ price: 50, history: [50] });
        }
    });

    setInterval(() => {
        marketRef.once('value').then(snap => {
            const node = snap.val() || { price: 50, history: [50] };
            let price = node.price;
            let history = node.history || [];
            const fluctuation = (Math.random() - 0.5) * 2;
            price = Math.max(1, price + fluctuation);
            history.push(price);
            if(history.length > 50) history.shift();
            marketRef.update({ price, history });
        });
    }, 5000);
}
startPriceSimulator();
