---
name: Domino's CRM
description: מערכת עבודה למוקד ההזמנות העסקיות של דומינוס – משטח שטוח, קווים במקום צללים, צבע רק כשצריך לפעול.
colors:
  navy: "#0B2340"
  navy-deep: "#081A31"
  navy-active: "#143462"
  navy-hover: "#1B3D6B"
  navy-text: "#C3D1E0"
  navy-muted: "#8DA2BA"
  brand-50: "#E8F2F7"
  brand-100: "#CFE4EF"
  brand-600: "#006491"
  brand-700: "#00567D"
  brand-800: "#003F5C"
  brand-sky: "#4FB0DC"
  brand-red: "#E31837"
  gray-25: "#F5F7F9"
  gray-50: "#F8FAFC"
  gray-100: "#E6EAEF"
  gray-200: "#D6DCE3"
  gray-300: "#C2CAD4"
  gray-400: "#8A96A5"
  gray-500: "#677585"
  gray-600: "#546272"
  gray-700: "#3A4756"
  gray-900: "#0F1B2A"
  white: "#FFFFFF"
  line-soft: "#EEF1F4"
  danger-bg: "#FCEBEE"
  danger-fg: "#C0102C"
  danger-line: "#EDB3BC"
  urgent-bg: "#FDF0E3"
  urgent-fg: "#A34A05"
  urgent-edge: "#E08A3C"
  missing-bg: "#FBF4D9"
  missing-fg: "#7A5D00"
  missing-edge: "#D8B53A"
  ok-bg: "#E6F3EC"
  ok-fg: "#16704A"
  ok-mark: "#2E9E62"
typography:
  kpi:
    fontFamily: "IBM Plex Sans Hebrew, Segoe UI, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.2
    fontFeature: "tnum"
  screen-title:
    fontFamily: "IBM Plex Sans Hebrew, Segoe UI, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.012em"
  section:
    fontFamily: "IBM Plex Sans Hebrew, Segoe UI, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.2
  card-title:
    fontFamily: "IBM Plex Sans Hebrew, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "IBM Plex Sans Hebrew, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  table:
    fontFamily: "IBM Plex Sans Hebrew, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "tnum"
  label:
    fontFamily: "IBM Plex Sans Hebrew, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  micro:
    fontFamily: "IBM Plex Sans Hebrew, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  tag: "4px"
  base: "6px"
  panel: "8px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "24px"
  space-6: "32px"
  control-sm: "28px"
  control-md: "36px"
  control-lg: "44px"
  icon-sm: "14px"
  icon-md: "16px"
  icon-lg: "20px"
  rail: "232px"
  topbar: "56px"
  gutter: "24px"
  card-x: "16px"
  page-max: "1440px"
components:
  button-primary:
    backgroundColor: "{colors.brand-600}"
    textColor: "{colors.white}"
    rounded: "{rounded.base}"
    height: "36px"
    padding: "0 16px"
    typography: "{typography.table}"
  button-primary-hover:
    backgroundColor: "{colors.brand-700}"
  button-primary-active:
    backgroundColor: "{colors.brand-800}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.gray-900}"
    rounded: "{rounded.base}"
    height: "36px"
    padding: "0 16px"
  button-secondary-hover:
    backgroundColor: "{colors.gray-50}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.gray-600}"
    rounded: "{rounded.base}"
  button-ghost-hover:
    backgroundColor: "{colors.gray-100}"
    textColor: "{colors.gray-900}"
  button-danger:
    backgroundColor: "{colors.white}"
    textColor: "{colors.danger-fg}"
    rounded: "{rounded.base}"
  button-danger-hover:
    backgroundColor: "{colors.danger-bg}"
  button-fix:
    backgroundColor: "{colors.white}"
    textColor: "{colors.gray-900}"
    rounded: "{rounded.base}"
    height: "28px"
  button-fix-hover:
    backgroundColor: "{colors.gray-50}"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.gray-900}"
    rounded: "{rounded.base}"
    height: "36px"
    padding: "0 12px"
  chip:
    backgroundColor: "{colors.white}"
    textColor: "{colors.gray-900}"
    rounded: "{rounded.base}"
    height: "36px"
    padding: "0 12px"
    typography: "{typography.label}"
  chip-on:
    backgroundColor: "{colors.brand-50}"
    textColor: "{colors.brand-800}"
  segmented:
    backgroundColor: "{colors.gray-100}"
    textColor: "{colors.gray-600}"
    rounded: "{rounded.panel}"
    height: "36px"
  segmented-on:
    backgroundColor: "{colors.white}"
    textColor: "{colors.gray-900}"
  card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.panel}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.navy-text}"
    rounded: "{rounded.base}"
    height: "36px"
    padding: "0 12px"
  table-header:
    backgroundColor: "{colors.white}"
    textColor: "{colors.gray-600}"
    height: "36px"
    typography: "{typography.micro}"
  table-row:
    backgroundColor: "{colors.white}"
    textColor: "{colors.gray-900}"
    height: "52px"
    typography: "{typography.table}"
  table-row-hover:
    backgroundColor: "{colors.gray-50}"
---

# Design System: Domino's CRM

## Overview

**Creative North Star: "עמדת מוקד"**

כלי עבודה של משמרת שלמה, לא מצגת. כחול-לילה מעגן את המותג בתפריט הצד ובמסך הכניסה; משטח העבודה לבן ושקט, אפור-כחלחל דק מסביב, וצבע מופיע רק איפה שצריך לפעול: הכפתור הראשי, השלב הבא, החריג. הדף שטוח – קווים דקים של פיקסל אחד מפרידים במקום צללים, וצל אמיתי שמור לדברים שצפים מעל הדף (תפריט, חלון, כרטיס הזמנה).

הצפיפות היא של כלי מקצועי: טבלאות עם שורות של 52px, מספרים בספרות טבלאיות שמתיישרות בעמודה, כותרת משנה של שורה אחת וטיפים רק בזמן עריכה. כל מספר, תאריך וטלפון עטוף בבידוד כיוון, כך שעברית ומספרים לא מתהפכים זה על זה. התנועה קצרה ופונקציונלית (90–220ms) ונעלמת לגמרי במצב "הפחת תנועה".

**Key Characteristics:**
- סולם אחד לכל דבר: מרווחים 4/8/12/16/24/32 (`--space-*`), שלושה גובהי פקדים 28/36/44 (`--control-*`), שלושה גדלי אייקון 14/16/20 (`--icon-*`).
- משטח שטוח: כרטיס = רקע לבן + קו של 1px, בלי צל.
- צבע אחד לפעולה (כחול דומינוס), אדום רק לקריטי וללוגו – כדי שמה שקריטי באמת יבלוט לאחמ"ש.
- סטטוסים כזוג רקע/טקסט עדין (אדום, כתום, צהוב, ירוק) – נקודה, טקסט ופס דק, לא משטחים צבעוניים.
- גופן אחד לכל המערכת (IBM Plex Sans Hebrew) עם ספרות טבלאיות.
- RTL מלא; מספרים מבודדים בכיוון שמאל-ימין.

## Colors

פלטה קרה ושקטה: כחול-לילה למסגרת, לבן ואפורים כחלחלים לעבודה, כחול דומינוס לפעולה, וארבעה צבעי מצב חלשים.

### Primary
- **כחול דומינוס** (#006491): כפתור ראשי, קישורים, טבעת פוקוס, לשונית ובחירה פעילה. כהה יותר לריחוף (#00567D) וללחיצה (#003F5C).
- **כחול דומינוס בהיר** (#E8F2F7 / #CFE4EF): רקע של בחירה (שורה מסומנת, צ'יפ פעיל, פוקוס בשורה) והבהוב "כאן היית".
- **כחול שמיים** (#4FB0DC): הדגשה על רקע כהה בלבד – הסמן של הפריט הפעיל בתפריט.

### Secondary
- **כחול-לילה** (#0B2340): תפריט הצד, מסך הכניסה ומסך הטעינה. גוונים: #081A31 עמוק, #143462 פריט נבחר, #1B3D6B ריחוף; טקסט #C3D1E0 ומעומעם #8DA2BA.

### Tertiary
- **אדום דומינוס** (#E31837): הלוגו ומונה התראה קריטי בתפריט. לא לשום דבר אחר.

### Neutral
- **משטח העבודה** (#F5F7F9): רקע הדף.
- **לבן** (#FFFFFF): כרטיסים, טבלאות, שדות.
- **אפור ריחוף** (#F8FAFC): ריחוף שורה וכותרות משניות.
- **קו הפרדה** (#E6EAEF) ו**קו בין שורות** (#EEF1F4).
- **גבול כפתור** (#D6DCE3), **גבול שדה בריחוף** (#C2CAD4), **placeholder ואייקון כבוי** (#8A96A5).
- **טקסט משני** (#546272), **טקסט ביניים** (#3A4756), **דיו** (#0F1B2A).

### Status
מיפוי אחד מחומרה לצבע: `SEVERITY_TONE` ב-`src/rules-engine/health.ts` (red → קריטי, orange → דחוף, yellow → חסר, info → מעקב בלי צבע). כל תג, שורה, מספר וקבוצה קוראים ממנו.
- **קריטי (אדום)** – רקע #FCEBEE, טקסט #C0102C, גבול #EDB3BC. רק: מועד שעבר, חיוב אשראי שנכשל, ביטול שלא בוצע בקופה, והזמנה של היום שלא ירדה ל-Q אחרי השעה שנקבעה. ובנוסף – כהתראה על **קטגוריה** שיש בה דבר דחוף שלא טופל (משימה ב"היום", מונה בתפריט): הזמנות שלא ירדו ל-Q, הזמנות שמועדן עבר, חריגות קריטיות, הצעות מחיר שלא חזרו אליהן.
- **דחוף (כתום)** – רקע #FDF0E3, טקסט #A34A05, קצה #E08A3C. אין אישור לקוח, לא עודכן בתפעול, פער מול Q, אשראי שלא חויב, פרט חסר בהזמנה של היום/מחר, מעקב מכירות באיחור.
- **חסר (צהוב)** – רקע #FBF4D9, טקסט #7A5D00, קצה #D8B53A. פרט חסר בהזמנה רחוקה, שורת פריטים לא שלמה.
- **מעקב** – בלי צבע (אפור משני): "לעדכן בתפעול" להזמנה רחוקה, משימות מעקב.
- **תקין** – רקע #E6F3EC, טקסט #16704A, וי #2E9E62.
- שגיאת קלט, פעולה הרסנית ואזהרת "לא אושרו" בסיכום לתפעול – באדום, כי הם שגיאה או סכנה ולא סטטוס.

### Named Rules
**The Color-Means-Act Rule.** צבע מופיע רק כשהוא אומר למשתמש לפעול או מסמן מצב. אין צבע לקישוט, אין רקעים צבעוניים למקטעים.

**The Red-Is-Rare Rule.** אדום מותג רק ללוגו ולמונה קריטי בתפריט; אדום מצב (#C0102C) רק לקריטי (ראו Status), לשגיאה ולפעולה הרסנית. כל השאר: דחוף בכתום, חסר בצהוב, מעקב בלי צבע.

## Typography

**Body Font:** IBM Plex Sans Hebrew (with Segoe UI, system-ui)
**Label/Mono Font:** אותו גופן, עם ספרות טבלאיות (`tnum`) – לשעות, סכומים, מספרי הזמנה, Q וטלפונים

**Character:** גופן אחד, ענייני וקריא בעברית, שההיררכיה בו נבנית מגודל ומשקל. שלושה משקלים בלבד: **600** לכותרות ולערך המרכזי בשורה (שם הלקוח, סכום, ערכי "להעברה לקופה"), **500** לתוויות, לפקדים ולתגים, **400** לגוף. אין 700 ו-800 (גם `<b>` מוגדר ל-600). אין גופן תצוגה נפרד.

### Hierarchy
- **KPI** (600, 28px, 1.2): מספר מרכזי בבורד ובמדדים.
- **Screen title** (600, 22px, 1.2, ‎-0.012em): כותרת מסך אחת לכל דף.
- **Section** (600, 20px, 1.2): כותרת אזור בבורד; ערכי מדדים בדוחות.
- **Card title** (600, 16px; 15px בתוך ראש כרטיס): כותרת כרטיס.
- **Body** (400, 15px, 1.5): טקסט רגיל ושדות.
- **Table** (400, 14px): תוכן טבלאות וכפתורים בגודל רגיל.
- **Label** (500, 13px): תוויות שדות, כותרת משנה, צ'יפים, כפתורים קטנים.
- **Micro** (500, 12px): כותרות עמודות, שורת משנה בטבלה.
- **מונים ותגים** – 12px/500 (Micro). אין טקסט קטן מ-12px.

### Named Rules
**The One-Line Subtitle Rule.** מתחת לכותרת מסך – שורה אחת של 13px באפור משני. הסברים נוספים רק בזמן עריכה.

**The Isolated Number Rule.** כל מספר, תאריך, שעה, סכום וטלפון בתוך טקסט עברי עטוף בבידוד כיוון (`<bdi dir="ltr">`) עם ספרות טבלאיות.

## Layout

מעטפת קבועה: תפריט צד כהה ברוחב 232px (ניתן לקיפול לאייקונים), סרגל עליון של 56px עם חיפוש ו"הזמנה חדשה" (בלי פעמון – מסך "היום" הוא המקום שמראה מה לעשות), ותוכן ברוחב מרבי 1440px עם שוליים של 24px.

**ראש מסך אחיד:** כותרת + שורת משנה אחת, פעולות בקצה השני, ומדדים (אם יש) כשורה אחת שקטה מתחת – "תווית ערך | תווית ערך" ב-13px, הערך 14px/600. לא מספרים גדולים בפינה ולא ברכה אישית. אחריו שורת מסננים, ואז כרטיסים וטבלאות זה מתחת לזה, 16px ביניהם. ראש כרטיס בגובה 52px עם ריפוד צד של 16px.

**מרווחים:** רק מהסולם 4/8/12/16/24/32 (`--space-1`…`--space-6`). 0–2px מותרים רק לתיקון אופטי.

הצפיפות גבוהה ומכוונת לעכבר ומקלדת: שורת טבלה 52px, ושלושה גובהי פקדים בלבד – **28** בתוך שורה (פעולה בשורה, ⋯, סטטוס), **36** רגיל (כפתור, שדה, צ'יפ, בקר מפולח, חיפוש בטבלה – כל שורת מסננים באותו גובה), **44** ראשי ומגע (לשוניות, פקדים בטלפון). טבלאות ארוכות נבנות בהדרגה (150–200 שורות ו"הצג עוד").

**נייד** (עד 700px): התפריט עובר לסרגל תחתון, טבלת ההזמנות הופכת לכרטיסים מקובצים לפי יום, מסננים ברשת של שני טורים ומדדים ברשת של שניים. נקודות שבירה משניות: 640, 860, 1100px.

## Elevation & Depth

מערכת שטוחה. עומק נוצר מקו ומגוון, לא מצל. שלוש רמות בלבד:

### Shadow Vocabulary
- **כרטיס אחד, בלי קינון:** בתוך כרטיס או בלוק מפרידים בקו של 1px ובמרווח – לא במסגרת, ברקע אפור או בכרטיס נוסף.
- **משטח** (`box-shadow: 0 0 0 1px #E6EAEF`): כל כרטיס ומשטח בדף – קו של פיקסל, בלי צל.
- **צף** (`0 0 0 1px rgba(15,27,42,.06), 0 4px 8px -2px rgba(15,27,42,.06), 0 12px 28px -6px rgba(15,27,42,.16)`): תפריטים נפתחים, פופאובר, טוסט. גובה מרבי – הגובה הפנוי במסך (עד 80vh), ואז גלילה בפנים. בלי חץ.
- **חלון** (`0 0 0 1px rgba(15,27,42,.06), 0 24px 64px rgba(15,27,42,.22)`): כרטיס הזמנה, דיאלוגים.
- **פוקוס** (`0 0 0 2px #FFFFFF, 0 0 0 4px #006491`): טבעת פוקוס מקלדת בכל רכיב אינטראקטיבי.

### Named Rules
**The Flat-By-Default Rule.** מה שיושב בדף – שטוח עם קו. צל רק למה שצף מעליו.

## Shapes

פינות מעוגלות בעדינות ובעקביות – שלוש בלבד: 4px לתגים ולמונים, 6px לכפתורים, שדות, צ'יפים ופריטי תפריט, 8px לכרטיסים, פאנלים, בקרים מפולחים וגלולות. קווים של 1px בלבד – אין פס צבע בצד של שורה, כרטיס או הודעה. נקודות מצב עגולות של 8px.

## Components

### Buttons
*ענייני ויציב: גובה קבוע, משקל 500, אייקון 16px מימין לתווית.*
- **Shape:** פינות 6px; גבהים 28 / 36 / 44px (sm / md / lg).
- **Primary:** רקע #006491, טקסט לבן. ריחוף #00567D, לחיצה #003F5C ותזוזה של 1px למטה.
- **Secondary:** לבן עם גבול #D6DCE3; ריחוף – רקע #F8FAFC וגבול #C2CAD4.
- **Ghost:** שקוף, טקסט #546272; ריחוף – רקע #E6EAEF וטקסט כהה.
- **Danger:** לבן, טקסט #C0102C, גבול #EDB3BC; ריחוף – רקע #FCEBEE.
- **Fix / פעולה בשורה:** שקט – לבן, טקסט דיו, גבול #D6DCE3, 500; ריחוף – רקע #F8FAFC. בלי מסגרת כחולה: הכחול שמור לכפתור הראשי של המסך.
- **פעולה אחת בשורה:** כפתור שקט אחד (התיקון, אחרת הצעד הבא בציר) ותפריט "⋯" עם השאר – הצעד הבא כשהכפתור תפוס, פתיחת ההזמנה, ו"ביטול הזמנה" באדום אחרי קו הפרדה.
- **Loading / Disabled:** ספינר במקום האייקון; כבוי – שקיפות 0.55.

### Chips & Segmented
- **Chip:** 36px (44px בטלפון), לבן עם גבול אפור, 13px/500. פעיל – רקע #E8F2F7, גבול #006491, טקסט #003F5C.
- **Segmented** (בחירת תקופה, תצוגה): 36px כולל המסילה – מסילה אפורה #E6EAEF בפינות 8px; האפשרות הנבחרת – לבנה עם קו דק, משקל 500. גרסה קטנה (בתוך שורה) – 28px.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** לבן על משטח #F5F7F9.
- **Shadow Strategy:** "משטח" (קו בלבד) – ראו Elevation.
- **Head:** 52px, ריפוד צד 16px, קו תחתון #E6EAEF, כותרת 15px/600.
- **בלי קינון:** בתוך כרטיס אין כרטיס, מסגרת או רקע אפור נוסף – רק קו ומרווח (כך גם בבלוק "להעברה לקופה": תכולה, סכום ושורת Q מופרדים בקו).

### Inputs / Fields
- **Style:** 36px, לבן, גבול #D6DCE3, פינות 6px; ריחוף – גבול #C2CAD4. Placeholder ב-#677585 (gray-500, ניגודיות 4.7:1).
- **Focus:** גבול #006491 והילה של 3px בכחול שקוף (rgba(0,100,145,.16)).
- **Label:** 13px/500 באפור משני מעל השדה; רמז 13px.
- **Missing:** שמירה עם פרטים חסרים מותרת – החוסר מסומן בצהוב (חסר), ובכתום כשההזמנה כבר היום/מחר.
- **LTR fields** (טלפון, Q): כיוון שמאל-ימין, יישור לימין, ספרות טבלאיות.

### Navigation
- **Rail:** כחול-לילה, פריט 36px, 14px/500 בצבע #C3D1E0. ריחוף – לבן שקוף 6%; פעיל – לבן שקוף 9%, טקסט לבן, אייקון וסמן של 3px בכחול שמיים.
- **Counts:** מונה 18px בלבן שקוף, 12px; אדום מותג רק לקטגוריה עם משהו קריטי שלא טופל (חריגים, הצעות מחיר שלא חזרו אליהן).
- **Collapsed:** אייקונים בלבד; המונה הופך לנקודה של 8px בפינה החיצונית (עם טבעת כחול-לילה), והמספר עובר ל-tooltip ולקורא מסך.
- **Mobile:** סרגל תחתון עם "עוד".

### Orders Table (signature)
- **Header:** 36px, 12px/500 אפור, קבוע בגלילה.
- **Row:** 52px, קו #EEF1F4 בין שורות, ספרות טבלאיות. ריחוף #F8FAFC; פוקוס מקלדת – רקע #E8F2F7 וסמן 3px כחול בקצה; נבחרת – #E8F2F7.
- **Critical row:** הנקודה והמילה "חריגה" באדום בעמודת התקינות – הצבע היחיד בשורה. בלי פס בקצה.
- **Customer:** 600; שורת סיבה 12px/500 מתחת.
- **Flash:** השורה שממנה נפתח הכרטיס מהבהבת פעם אחת (1.2s) בסגירה.

### Health dot & Mark (signature)
- **Health:** נקודה של 8px בצבע המצב + טקסט באותו צבע (קריטי / דחוף / חסר / תקין).
- **Mark:** וי בעיגול ירוק לשלב שהושלם; עיגול מקווקו אפור לשלב שחסר – בריחוף הופך לכחול.

### Toast & Tooltip
- **Toast:** משטח "צף"; שגיאה – סמן אדום בקצה ואייקון אזהרה, נקרא מיד לקורא מסך.
- **Tooltip:** רקע #0F1B2A, טקסט לבן 13px.

## Do's and Don'ts

### Do:
- **Do** להשתמש רק בטוקנים מ-`src/design/tokens.css` – צבע, גודל, פינה וצל.
- **Do** לקחת מרווח מ-`--space-*`, גובה פקד מ-`--control-*` וגודל אייקון מ-`--icon-*` – ערך שלא בסולם הוא באג.
- **Do** לשמור את כל מה שיושב בדף שטוח עם קו של 1px (#E6EAEF), וצל רק למה שצף.
- **Do** לעטוף כל מספר, תאריך, סכום וטלפון ב-`<Ltr>` עם ספרות טבלאיות.
- **Do** לסמן מצב בזוג רקע/טקסט עדין או בנקודה – לא במשטח צבעוני מלא.
- **Do** להסתיר טיפים ב-`visibility: hidden` ולא ב-`display: none`, כדי שכפתורים לא יזוזו מתחת ליד.
- **Do** לכבד `prefers-reduced-motion` – כל משכי התנועה מתאפסים.

### Don't:
- **Don't** לצבוע באדום משהו שאינו קריטי, שגיאה או פעולה הרסנית.
- **Don't** לשים פס צבע בצד של שורה, כרטיס או הודעה, ולא כרטיס בתוך כרטיס.
- **Don't** להשתמש במשקל 700/800 או בטקסט קטן מ-12px.
- **Don't** להשתמש באדום מותג (#E31837) לשום דבר מלבד הלוגו ומונה קריטי.
- **Don't** להוסיף צללים, גרדיאנטים או רקעים צבעוניים לכרטיסים ולמקטעים. (גרדיאנט קיים רק ברקע מסך הכניסה ובאנימציית הטעינה.)
- **Don't** להוסיף גופן נוסף.
- **Don't** לכתוב פסקאות הסבר על המסך – כותרת משנה של שורה אחת.
- **Don't** להציג מחירי דוגמה בהצעות ובמוקאפים (₪—).
