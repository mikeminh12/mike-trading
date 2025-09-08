// script.js (REPLACE your old file with this)

// Firebase config (giữ nguyên của bạn)
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
const auth = firebase.auth();
const db = firebase.database();

// GLOBALS
let currentUID = null;
let currentPrice = 50;         // updated from DB
const usersMap = {};          // { uid: {username, balanceUSD, mCoinAmount} }
let listenersInitialized = false;

// --- Chart.js setup (keep as before) ---
const ctx = document.getElementById('priceChart').getContext('2d');
const priceChart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'mCoin Price', data: [], borderColor: 'rgb(75, 192, 192)', tension: 0.2 }] },
    options: { responsive: true }
});

// --- AUTH functions ---
function register() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if(!email || !password) return alert("Nhập email và password!");

    auth.createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
        const uid = userCredential.user.uid;
        db.ref('users/' + uid).set({
            username: email.split('@')[0],
            balanceUSD: 1000,
            mCoinAmount: 0
        }).then(() => {
            alert('Đăng ký thành công!');
            showDashboard(uid);
        });
    })
    .catch(error => alert(error.message));
}

function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if(!email || !password) return alert("Nhập email và password!");

    auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
        showDashboard(userCredential.user.uid);
    })
    .catch(error => alert(error.message));
}

function logout() {
    // detach per-user listener
    if (currentUID) db.ref('users/' + currentUID).off('value');
    currentUID = null;
    auth.signOut().then(() => {
        document.getElementById('auth').style.display = 'block';
        document.getElementById('dashboard').style.display = 'none';
    });
}

// --- RENDER leaderboard ---
function renderLeaderboard() {
    // build array from usersMap
    const arr = Object.keys(usersMap).map(uid => {
        const u = usersMap[uid];
        const usd = Number(u.balanceUSD) || 0;
        const m = Number(u.mCoinAmount) || 0;
        const asset = usd + m * (Number(currentPrice) || 50);
        return { username: u.username || uid, asset };
    });

    arr.sort((a,b) => b.asset - a.asset);
    const body = document.getElementById('leaderboardBody');
    if(!body) return;
    let html = '';
    arr.forEach((u, i) => {
        html += `<tr>
            <td>${i+1}</td>
            <td>${escapeHtml(u.username)}</td>
            <td>$${Number(u.asset).toFixed(2)}</td>
        </tr>`;
    });
    body.innerHTML = html;
}

// small helper to avoid XSS (in case)
function escapeHtml(text) {
  if (!text && text !== 0) return '';
  return String(text).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; });
}

// --- Toast ---
function showToast(msg) {
    const container = document.getElementById('toastContainer');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = msg;
    container.appendChild(toast);

    // animate in
    setTimeout(() => toast.classList.add('show'), 50);
    // auto hide after 5s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 5000);
}

// push notification both to DB and immediate toast
function pushNotification(msg) {
    // push to DB for other clients
    db.ref('notifications').push().set(msg);
    // local immediate toast
    showToast(msg);
}

// listen notifications -> show toasts
db.ref('notifications').on('child_added', snap => {
    const m = snap.val();
    if(m) showToast(m);
});

// --- Set up global listeners once ---
function initGlobalListeners() {
    if (listenersInitialized) return;
    listenersInitialized = true;

    // MARKET price listener
    db.ref('market/mCoin').on('value', snap => {
        const data = snap.val();
        if(data && typeof data.price !== 'undefined') {
            currentPrice = Number(data.price) || currentPrice;
            // update chart + DOM
            document.getElementById('mCoinPrice').innerText = Number(currentPrice).toFixed(2);
            const history = data.history || [];
            priceChart.data.labels = history.map((_, i) => i+1);
            priceChart.data.datasets[0].data = history;
            priceChart.update();
            // price changed -> re-render leaderboard with new valuation
            renderLeaderboard();
        }
    });

    // USERS realtime by child events (fast + incremental)
    const usersRef = db.ref('users');
    usersRef.on('child_added', childSnap => {
        usersMap[childSnap.key] = childSnap.val() || {};
        renderLeaderboard();
    });
    usersRef.on('child_changed', childSnap => {
        usersMap[childSnap.key] = childSnap.val() || {};
        renderLeaderboard();
    });
    usersRef.on('child_removed', childSnap => {
        delete usersMap[childSnap.key];
        renderLeaderboard();
    });
}

// --- Dashboard per-user ---
function showDashboard(uid) {
    currentUID = uid;
    document.getElementById('auth').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';

    // init global listeners once
    initGlobalListeners();

    // listen current user info realtime (for user-specific display)
    db.ref('users/' + uid).on('value', snap => {
        const data = snap.val() || {};
        document.getElementById('username').innerText = data.username || '';
        document.getElementById('balanceUSD').innerText = (Number(data.balanceUSD)||0).toFixed(2);
        document.getElementById('mCoinAmount').innerText = (Number(data.mCoinAmount)||0).toFixed(2);
    });
}

// --- Trading actions ---
function buyMCoin() {
    if(!auth.currentUser) return alert('Chưa đăng nhập!');
    const uid = auth.currentUser.uid;
    const amount = parseFloat(document.getElementById('tradeAmount').value);
    if(!amount || amount <= 0) return alert('Nhập số hợp lệ!');

    db.ref('market/mCoin/price').once('value').then(snap => {
        const price = Number(snap.val()) || currentPrice;
        db.ref('users/' + uid).once('value').then(userSnap => {
            const user = userSnap.val() || {};
            const usd = Number(user.balanceUSD) || 0;
            const m = Number(user.mCoinAmount) || 0;
            const cost = amount * price;
            if(usd >= cost) {
                db.ref('users/' + uid).update({
                    balanceUSD: usd - cost,
                    mCoinAmount: m + amount
                }).then(() => {
                    const name = user.username || uid;
                    pushNotification(`${name} vừa mua ${amount} mCoin 💸`);
                });
            } else alert('Không đủ USD!');
        });
    });
}

function sellMCoin() {
    if(!auth.currentUser) return alert('Chưa đăng nhập!');
    const uid = auth.currentUser.uid;
    const amount = parseFloat(document.getElementById('tradeAmount').value);
    if(!amount || amount <= 0) return alert('Nhập số hợp lệ!');

    db.ref('market/mCoin/price').once('value').then(snap => {
        const price = Number(snap.val()) || currentPrice;
        db.ref('users/' + uid).once('value').then(userSnap => {
            const user = userSnap.val() || {};
            const usd = Number(user.balanceUSD) || 0;
            const m = Number(user.mCoinAmount) || 0;
            if(m >= amount) {
                db.ref('users/' + uid).update({
                    balanceUSD: usd + amount * price,
                    mCoinAmount: m - amount
                }).then(() => {
                    const name = user.username || uid;
                    pushNotification(`${name} vừa bán ${amount} mCoin 💰`);
                });
            } else alert('Không đủ mCoin!');
        });
    });
}

// --- Price simulator (same as before) ---
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
            let price = Number(node.price) || 50;
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
