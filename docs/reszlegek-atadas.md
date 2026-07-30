# Részlegalapú feladatkezelés — átadási dokumentáció

Készült: 2026-07-30 · Állapot: **helyben elkészült és letesztelve, éles adatbázison még nem futott**

---

## 1. Mit tud a funkció

Minden publikus feladat pontosan **egy részleghez** tartozik, **vagy** a **Teljes cég**
számára látható. Egy felhasználó azokat a feladatokat látja, amelyek a saját
részlegeihez tartoznak, plusz az összes Teljes cég feladatot. Az ADMIN mindent lát.

A szabály **szerveroldalon** dől el. A kliens szűrője csak szűkíteni tud azon belül,
amit a szerver egyáltalán visszaad — kiszélesíteni nem.

---

## 2. Adatmodell-változások

### Új enum

```prisma
enum TicketVisibility { DEPARTMENT COMPANY_WIDE }
```

### Új táblák

| Tábla | Mire jó |
|---|---|
| `Department` | A részlegek. `name` egyedi, `nameNormalized` egyedi, `color` a badge színe. |
| `UserDepartment` | Felhasználó ↔ részleg kapcsolótábla, `@@unique([userId, departmentId])`. |

**Miért van `nameNormalized` oszlop?** Egy `LOWER("name")` alapú egyedi index csak
akkor kezeli az ékezeteket, ha az adatbázis UTF-8 tudatú kollációval készült. A helyi
fejlesztői adatbázis `C` kollációval fut, ott a `LOWER()` csak az ASCII-t hajtja le,
így az „EGYEDI TALPBETÉT" simán bekerült volna az „Egyedi talpbetét" mellé. A tárolt,
alkalmazás által írt oszlop kollációtól függetlenül helyes.

### Meglévő táblák bővítése

```prisma
model Ticket {
  visibility   TicketVisibility @default(DEPARTMENT)
  departmentId String?
  department   Department?      @relation(fields: [departmentId], references: [id], onDelete: Restrict)
  @@index([visibility, departmentId])
  @@index([departmentId])
}

model UserPermissions {
  canCreateCompanyWideTasks Boolean @default(false)
}
```

### Adatbázis-szintű megkötés

A párosítási szabályt maga az adatbázis tartja be, nem csak a kód:

```sql
CHECK (
  ("visibility" = 'DEPARTMENT'   AND "departmentId" IS NOT NULL) OR
  ("visibility" = 'COMPANY_WIDE' AND "departmentId" IS NULL)
)
```

A `Ticket.departmentId` idegen kulcs **`ON DELETE RESTRICT`**: olyan részleg, amihez
még tartozik feladat, nem törölhető. (A `SET NULL` — ami a Prisma alapértelmezése
opcionális kapcsolatnál — a fenti CHECK-be futna bele, tehát a törlés úgy is
elbukna, csak zavarosabb hibával.)

---

## 3. Hogyan működik a hozzáférés — `lib/departments-access.ts`

**Ez az egyetlen hely, ahol a szabály le van írva.** Minden feladat-végpont ezen
keresztül megy, hogy az egyes route-ok feltételei ne tudjanak elcsúszni egymástól.

```ts
ticketAccessWhere(user)            // ADMIN ⇒ {} ; egyébként OR: [COMPANY_WIDE, saját részlegek]
scopedTicketWhere(user, filters)   // a fentit AND-del kombinálja a kért szűrőkkel
canAccessTicket(user, ticketId)    // egy konkrét feladat elérhető-e
assertTicketAccess(...)            // dobó változat
notFoundResponse(msg?)             // 404, hogy a feladat léte se derüljön ki
getSelectableDepartments(user)     // létrehozásnál választható részlegek
resolveTicketTarget(user, target, canCreateCompanyWide)  // a cél szerveroldali feloldása
getEligibleTicketUsers(ticket)     // felelős/említés jelöltek
isEligibleAssignee(userId, ticket)
```

Két szándékos döntés:

- **A kombinálás mindig `AND`.** Egy kért szűrő soha nem `OR`-ral kerül a hozzáférési
  feltétel mellé, így egy szűrőparaméter nem tudja kinyitni a láthatóságot.
- **Jogosulatlan hozzáférés `404`, nem `403`.** A `403` elárulná, hogy a feladat
  létezik. Minden érintett végpont a közös `notFoundResponse()`-t adja vissza.

### Kliensbiztos / szerveroldali szétválasztás

| Fájl | Tartalom | Importálható kliensből |
|---|---|---|
| `lib/departments.ts` | konstansok, `normalizeDepartmentName`, `badgeColors` | **igen** |
| `lib/departments-access.ts` | a Prismát használó hozzáférési szabályok | nem |

Ez nem stílus kérdése: amikor a kliens komponensek a Prismát is importáló modulból
vették a konstansokat, a build elhasalt (`Module not found: Can't resolve 'dns'`),
mert a `pg` bekerült a böngésző-bundle-be. Ugyanaz a felosztás, mint a
`lib/private-tasks.ts` / `lib/private-tasks-auth.ts` párnál.

---

## 4. Hol kezelhető

| Mit | Hol |
|---|---|
| Részlegek létrehozása / átnevezése / szín / törlés | **Beállítások → Részlegek** (csak ADMIN) |
| Felhasználó részlegei | **Felhasználók** oldal, a felhasználó sorában chipek |
| „Teljes céges feladat létrehozása" jog | ugyanott, `canCreateCompanyWideTasks` kapcsoló |
| Feladat részlegének utólagos módosítása | a feladat oldalán, oldalsávban (csak ADMIN) |

**Részleg elvétele védve van:** ha a felhasználónak abban a részlegben még van
nyitott, rá bízott feladata, a mentés `409`-cel elutasítja, és visszaadja a blokkoló
feladatok listáját linkkel. A részlegek a beállítások előtt mentődnek, hogy egy
elutasított elvétel ne hagyjon félig mentett állapotot.

---

## 5. Feladat létrehozása és a felelős

- A célt (részleg vagy Teljes cég) **a szerver oldja fel** a `resolveTicketTarget`-tel,
  a kliens által küldött értéket nem hiszi el: a tagságot a mentés pillanatában
  kérdezi vissza az adatbázisból, nem abból, ami az űrlap betöltésekor igaz volt.
- Akinek egyetlen részlege van és nincs céges joga, annál a részleg automatikusan
  kiválasztódik.
- Akinek **egy sem** és nincs céges joga, nem tud feladatot létrehozni.
- A felelős csak olyan ember lehet, aki az adott célt látja. Részlegváltásnál a
  szerver újraellenőrzi a felelőst az **új** cél ellen, és hiba esetén
  `reason: 'ASSIGNEE_NOT_IN_DEPARTMENT'`-tel válaszol.
- Az `@említés` és a személyválasztók listája szintén a feladat céljához szűkül
  (`/api/users?forDepartmentId=…`).

---

## 6. A részleghez rendelésről szóló e-mail

`sendDepartmentAssignmentEmail` a `lib/email.ts`-ben.

- **Egyetlen összefoglaló levél** megy, nem részlegenként egy.
- Csak a **most hozzáadott** részlegekről, és csak a **commit után**, a tényleges
  elmentett sorok alapján.
- A létrehozási lehetőséget csak akkor említi, ha a felhasználónak valóban van rá joga.
- **Feladatadatot nem tartalmaz**, csak egy linket a `/tickets` oldalra.
- Ha a levél nem megy ki, a hozzárendelés **érvényben marad**, a válasz
  `emailSent: false`, és a Naplóba `department_assignment_email_failed` kerül.

Ehhez kellett egy `sendEmailOrThrow`: a meglévő `sendEmail` egy elutasított Resend
kérésnél csak logol és visszatér, így a `try/catch` soha nem sült volna el, és
`emailSent: true`-t jelentettünk volna hibás küldésnél is.

---

## 7. Naplózás

Feladat-tevékenységként: `department_changed` (emberi olvasható régi → új címkékkel).

Rendszereseményként: `department_created`, `department_renamed`,
`department_color_changed`, `department_deleted`, `user_departments_added`,
`user_departments_removed`, `department_assignment_email_sent`,
`department_assignment_email_failed`.

---

## 8. A migráció

**Fájl:** `prisma/migrations/20260725090000_add_departments/migration.sql`

Sorrend (szándékosan ilyen, hogy egyetlen pillanatban se legyen inkonzisztens sor):

1. `CREATE TYPE "TicketVisibility"`
2. `Department` + `UserDepartment` tábla, indexek, idegen kulcsok
3. A kezdő részleg beszúrása: `dept_egyedi_talpbetet` / „Egyedi talpbetét"
4. `Ticket.visibility` (default `DEPARTMENT`) és `Ticket.departmentId` oszlop
5. **Minden meglévő feladat** átkötése az „Egyedi talpbetét" részlegre
6. **Minden `ACTIVE` felhasználó** felvétele az „Egyedi talpbetét" részlegbe
   (`INSERT … SELECT … ON CONFLICT DO NOTHING`)
7. Idegen kulcs, indexek, majd a `CHECK` megkötés — csak most, amikor már minden sor
   konzisztens
8. `UserPermissions.canCreateCompanyWideTasks` oszlop

**A migráció nem küld e-mailt.** A kezdeti „Egyedi talpbetét" hozzárendelésekről
szándékosan nem megy értesítés — az SQL nem hív alkalmazáskódot, tehát nincs is mit
letiltani, de a fájlban ezt kommentben is rögzítettem, hogy később se kerüljön bele.

### Éles futtatás — kézi lépések

Ezt **nekem nem volt szabad** megtennem, és nem is tettem meg. A javasolt sorrend:

```bash
# 1. Mentés az éles adatbázisról (Neon: branch vagy pg_dump)
# 2. A migráció alkalmazása — SOHA nem `migrate dev`, mindig `deploy`:
npx prisma migrate deploy
```

3. Ellenőrzés az éles adatbázison a migráció után:
   - minden feladatnak van `departmentId`-ja, vagy `COMPANY_WIDE`,
   - minden aktív felhasználó benne van az „Egyedi talpbetét" részlegben,
   - a `Ticket_visibility_department_check` megkötés létezik.
4. Deploy.
5. A **Beállítások → Részlegek** alatt létrehozni a valódi részlegeket, majd a
   **Felhasználók** oldalon átrendezni az embereket. Ekkor már megy az értesítő
   e-mail is az új hozzárendelésekről.

> `prisma migrate dev` az éles adatbázis ellen **soha** — az eldobhatja és
> újraépítheti a sémát.

---

## 9. Mit teszteltem és mi lett az eredménye

### Hozzáférési szabályok (szerveroldali, 42 állítás — mind sikeres)

Öt teszt-felhasználóval, minden szerepkör/részleg kombinációra: az ADMIN mindent lát;
a részlegekhez tartozók csak a sajátjaikat plusz az összes céges feladatot; a részleg
nélküli felhasználó **csak** a céges feladatokat; egy idegen részlegre szűrés
0 találatot ad; egy idegen feladat közvetlen elérése elutasítva; a létrehozási cél és a
felelős-jelöltek a vártak; kitalált és `null` részleg-azonosító elutasítva.

### Adatbázis-szintű megkötések (friss adatbázison, mind a 4 eset helyes)

`DEPARTMENT` részleg nélkül → elutasítva. `COMPANY_WIDE` részleggel → elutasítva.
Helyes `DEPARTMENT` → átmegy. Feladatokkal rendelkező részleg törlése → elutasítva.

### Migráció

Nulláról létrehozott adatbázison mind a 23 migráció lefutott, és a
`prisma migrate diff` **„No difference detected"**-et ad a `schema.prisma`-hoz
képest — nincs elcsúszás.

### Böngésző

ADMIN folyamatok végig, asztali és mobilnézetben (375×812): szűrősáv, Részleg oszlop,
badge-ek, létrehozás céges megerősítéssel, részleg utólagos módosítása.
A vízszintes görgetés a szűrősávon belül marad, az oldal nem csúszik el.

### Kontraszt

A badge-ek WCAG AA (4.5:1) szintet érnek el 12px szövegnél. A teljes preset paletta
plusz 140 608 végigpróbált egyéni szín teljesíti; a legrosszabb eset pontosan 4.50:1.

### Típus és build

`tsc --noEmit` hibátlan · `next build` sikeres · lint a korábbi alapszinten
(16 hiba, mind általam nem érintett fájlokban) · `any`, `@ts-ignore`,
`@ts-expect-error`, `as never` és indokolatlan lint-kikapcsolás nincs a változtatásokban.

---

## 10. Amit közben javítanom kellett

Ezek valódi hibák voltak, nem elméleti aggályok:

- **A dupla létrehozás elleni védelem nem működött.** `if (loading) return` volt benne,
  de a `setLoading` aszinkron: hat egy tickben leadott kattintás mindegyike
  `loading === false`-t látott, és **hat feladat jött létre**. Szinkron `ref`-re
  cseréltem — újratesztelve hat kattintás → egy feladat.
- **A Logisztika badge kontrasztja 4.33:1 volt**, a 4.5 alatt. Középtónusú színeknél
  sem a fehér, sem a majdnem-fekete szöveg nem ér el 4.5-öt, tehát a „válaszd a jobbat"
  logika kevés. A `badgeColors()` most a részleg saját színét tolja el a fekete↔fehér
  tengelyen, amíg a pár át nem megy — a szín felismerhető marad. Ugyanez a hiba
  megvolt a szűrő-chipeken, a felhasználói chipeken és az e-mailben is; az e-mail
  saját, duplikált számítást használt, ezt megszüntettem, most a közös függvényt hívja.
- **Egy új részleg csendben láthatatlan maradt** annak, aki egyszer leszűkítette a
  szűrőjét. Most a mentett szűrő eltárolja, mely részlegeket „ismerte" a felhasználó,
  és az azóta létrejöttek egyszer automatikusan bekerülnek a kijelölésbe. Ha utána
  kézzel kikapcsolja, az megmarad.
- **A migráció elcsúszott a schemától** két ponton (`Department.updatedAt` DB-default,
  és a `Ticket.departmentId` idegen kulcs viselkedése). Mindkettőt összehangoltam, és
  friss adatbázison igazoltam, hogy nincs eltérés.
- **A fájl-proxy szivárgott:** bármely bejelentkezett felhasználó le tudta kérni
  bármelyik csatolmányt az URL-jével. Most a csatolmányt előbb feloldja a feladatára,
  és arra ellenőriz.
- **READER 500-at kapott 403 helyett** három végponton, mert a `catch` nem kezelte a
  `FORBIDDEN`-t. Javítva, magyar hibaszöveggel.

---

## 11. Ismert korlátok és kézi lépések

- **Az éles adatbázison a migráció még nem futott.** Ez szándékos; a 8. pont írja le
  a lépéseket.
- **A valódi részlegeket kézzel kell létrehozni**, és az embereket kézzel kell
  hozzárendelni. A migráció mindenkit az „Egyedi talpbetét"-be tesz, hogy a bevezetés
  pillanatában senki ne veszítsen látható feladatot.
- **A migráció nem küld e-mailt** a kezdeti hozzárendelésekről; a későbbi, kézi
  hozzárendelésekről igen.
- **Egy feladat egy részleghez tartozik.** Több részleg egyszerre nincs; ha ilyen kell,
  az a Teljes cég beállítás.
- **A nem-ADMIN böngészős végigjátszás jelszavas belépéssel nem futott le** — a
  környezet biztonsági okból blokkolta a teszt-felhasználók jelszavának beállítását és
  a belépést a nevükben. Helyette a szabályokat közvetlenül, szerveroldalon teszteltem
  végig (9. pont, 42 állítás), ami ugyanazt a modult járja végig, amin minden végpont
  keresztülmegy. Az AGENT és READER **végpont-szintű** viselkedését korábban ebben a
  munkamenetben ellenőriztem (innen jött a 403-as javítás). Érdemes egy valódi AGENT
  és READER fiókkal átkattintani a felületet a bevezetés előtt.
- **Nincs dark theme** a myBatz-ban, tehát nem is kellett hozzá igazítani; operációs
  rendszer szintű dark módban a felület változatlanul jelenik meg.
