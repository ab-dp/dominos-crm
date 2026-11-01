/* ח.פ / ע.מ / ת.ז – 9 ספרות עם ספרת ביקורת (אפיון 13: "ח.פ (ספרת ביקורת)") */
export function cleanTaxId(raw) {
    return raw.replace(/\D/g, '');
}
export function isValidTaxId(raw) {
    const d = cleanTaxId(raw);
    if (d.length < 5 || d.length > 9)
        return false;
    const s = d.padStart(9, '0');
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        let n = Number(s[i]) * (i % 2 === 0 ? 1 : 2);
        if (n > 9)
            n -= 9;
        sum += n;
    }
    return sum % 10 === 0;
}
export function taxIdError(raw) {
    if (!cleanTaxId(raw))
        return '';
    return isValidTaxId(raw) ? '' : 'מספר ח.פ לא תקין – ספרת הביקורת לא מתאימה. בדוק שהוקלדו 9 ספרות נכונות.';
}
