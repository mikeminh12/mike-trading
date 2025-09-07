// Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

function register() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    auth.createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
        const uid = userCredential.user.uid;
        db.ref('users/' + uid).set({
            username: email.split('@')[0],
            balance: 1000
        });
        alert('Đăng ký thành công!');
    })
    .catch(error => alert(error.message));
}

function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
        showDashboard(userCredential.user.uid);
    })
    .catch(error => alert(error.message));
}

function showDashboard(uid) {
    document.getElementById('auth').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    db.ref('users/' + uid).on('value', snapshot => {
        const data = snapshot.val();
        document.getElementById('username').innerText = data.username;
        document.getElementById('balance').innerText = data.balance;
    });
}

function updateBalance() {
    const uid = auth.currentUser.uid;
    const amount = parseFloat(document.getElementById('amount').value);
    const userRef = db.ref('users/' + uid);
    userRef.once('value').then(snapshot => {
        const currentBalance = snapshot.val().balance;
        userRef.update({ balance: currentBalance + amount });
    });
}

function logout() {
    auth.signOut().then(() => {
        document.getElementById('auth').style.display = 'block';
        document.getElementById('dashboard').style.display = 'none';
    });
}
