const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

// 暗号化の設定
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
const IV_LENGTH = 16;

// 暗号化関数
function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// 復号関数
function decrypt(text) {
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        return text; // 暗号化されていなければそのまま返す
    }
}

// データを保存する
function saveFile(filename, data) {
    const jsonString = JSON.stringify(data, null, 2);
    const encryptedData = encrypt(jsonString);
    fs.writeFileSync(filename, encryptedData);
}

// データを読み込む
function loadFile(filename) {
    try {
        if (!fs.existsSync(filename)) {
            saveFile(filename, {});
            return {};
        }
        const fileContent = fs.readFileSync(filename, 'utf8');
        const decryptedJson = decrypt(fileContent);
        return JSON.parse(decryptedJson);
    } catch (error) {
        console.error(`${filename}の読み込みエラー: `, error);
        return {};
    }
}

// ほかのファイルで使えるようにエクスポート
module.exports = { saveFile, loadFile };
