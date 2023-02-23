const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/user');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const imageDownloader = require('image-downloader');
const multer = require('multer');
const fs = require('fs');
const Place = require('./models/place');
const BookingModel = require('./models/booking');


const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = 'hellodoctorheartmissayye';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));
app.use(cors({
    credentials: true,
    origin: 'http://localhost:3000',
}));


mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true, }).
    then(() => console.log('connection succesfull'))
    .catch((e) => console.log('db connection error', e));


app.get('/test', (req, res) => {
    res.json('test ok');
});

function getUserDataFromReq(req) {
    return new Promise((resolve, reject) => {
        jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
            if (err) throw err;
            resolve(userData);
        });
    });
}

app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const userDoc = await User.create({
            name,
            email,
            password: bcrypt.hashSync(password, bcryptSalt)
        })
        res.json(userDoc);
    }
    catch (e) {
        res.status(422).json(e);
    }

})

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const UserDoc = await User.findOne({ email });
    if (UserDoc) {
        const passOK = bcrypt.compareSync(password, UserDoc.password)
        if (passOK) {
            jwt.sign({ email: UserDoc.email, id: UserDoc._id }, jwtSecret, {}, (err, token) => {
                if (err) throw err;
                res.cookie('token', token, { secure: true, sameSite: 'none' }).json(UserDoc);
            });
        }
        else {
            res.status(422).json('pass not okay');
        }
    }
    else { res.json('Not found'); }
})

app.get('/profile', (req, res) => {
    const { token } = req.cookies;
    if (token) {
        jwt.verify(token, jwtSecret, {}, async (err, userData) => {
            if (err) { throw err }
            const { name, email, _id } = await User.findById(userData.id)
            res.json({ name, email, _id });
        })
    } else {
        res.json(null);
    }
})

app.post('/logout', (req, res) => {
    res.cookie('token', '', { secure: true, sameSite: 'none' }).json(true);
});

app.post('/upload-by-link', async (req, res) => {
    const { link } = req.body;
    const newName = 'photo' + Date.now() + '.jpg';
    await imageDownloader.image({
        url: link,
        dest: __dirname + '/uploads/' + newName,
    });
    res.json(newName);
})

const photosMiddleware = multer({ dest: 'uploads/' });

app.post('/upload', photosMiddleware.array('photos', 100), async (req, res) => {
    const uploadedFiles = [];
    for (let i = 0; i < req.files.length; i++) {
        const { path, originalname } = req.files[i];
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        let newPath = path + '.' + ext;
        fs.renameSync(path, newPath);
        console.log(newPath);
        newPath = newPath.replace('uploads\\', '');
        console.log(newPath);
        uploadedFiles.push(newPath);
    }
    res.json(uploadedFiles);

});

app.post('/places', (req, res) => {
    const { token } = req.cookies;
    const { title, address, addedPhotos, description
        , perks, extraInfo, checkIn, checkOut, maxGuest, price } = req.body;
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        if (err) { throw err }
        const placeDoc = await Place.create({
            owner: userData.id,
            title, address, photos: addedPhotos, description, perks, extraInfo, checkIn, checkOut, maxGuest, price
        })
        res.json(placeDoc);
    })
});

app.get('/user-places', (req, res) => {
    const { token } = req.cookies;
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        const { id } = userData;
        res.json(await Place.find({ owner: id }));
    });
})

app.get('/places/:id', async (req, res) => {
    const { id } = req.params;
    res.json(await Place.findById(id));
})

app.put('/places', async (req, res) => {
    const { token } = req.cookies;
    const { id, title, address, addedPhotos, description, price
        , perks, extraInfo, checkIn, checkOut, maxGuest } = req.body;
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        const placeDoc = await Place.findById(id);
        if (userData.id === placeDoc.owner.toString()) {
            placeDoc.set({
                title, address, photos: addedPhotos, description, perks, extraInfo, checkIn, checkOut, maxGuest, price
            });
            await placeDoc.save();
            res.json('ok');
        }
    });
})


app.get('/places', async (req, res) => {
    res.json(await Place.find());
})

app.post('/bookings', async (req, res) => {
    const userData = await getUserDataFromReq(req);
    const { place, checkIn,
        checkOut, numberOfGuests,
        name, phone, price } = req.body;
    BookingModel.create({
        place, checkIn,
        checkOut, numberOfGuests,
        name, phone, price, user: userData.id
    })
        .then((doc) => {
            res.json(doc);
        })
        .catch(err => {
            throw err;
        })
})



app.get('/bookings', async (req, res) => {
    const userData = await getUserDataFromReq(req);
    res.json(await BookingModel.find({
        user: userData.id
    }).populate('place'));
})

app.get('/', (req, res) => {
    res.json('you are in home page of server');
});

app.listen(4000);