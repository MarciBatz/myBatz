# myBatz — Belső ügyfélszolgálati és munkaszervezési rendszer

## 1. Mi ez, és miért készült?

A **myBatz** egy egyedi fejlesztésű, belső webalkalmazás egy kis-közepes csapat (kb. 10-20 fő) napi munkaszervezésére. Nem egy általános projektmenedzsment-eszköz — kifejezetten erre a csapatra lett szabva, egyetlen fejlesztő (a rendszergazda/tulajdonos) és AI-asszisztens (Claude) közös munkájával épült, folyamatosan bővülő funkciókkal.

A rendszer három fő problémát old meg egyszerre:
1. **Belső ügyfélszolgálati jegyrendszer** (ticketing) — ki, mit, kinek csinál, milyen státuszban van
2. **Csapat-naptár** — bolti szűrőnapok beosztása, irodai hetes rotáció, szabadságok, egyéb események
3. **Személyes feladatkövetés** — mindenki saját, privát munkalistája, ami opcionálisan összeköthető a nyilvános jegyekkel

A rendszert a kollégák **naponta, aktívan használják** — ez élő, éles termelési rendszer, nem belső prototípus.

---

## 2. Technikai alapok (röviden, kontextusnak)

- **Next.js** (App Router) + **TypeScript**, **Tailwind CSS**
- **PostgreSQL** adatbázis (**Neon**, felhő-alapú), **Prisma ORM**-mel kezelve
- Hosting: **Vercel** (Hobby csomag), automatikus deploy minden `git push`-ra a `main` branch-re
- Munkamenet-kezelés: JWT-alapú, saját middleware-rel védett API-útvonalak
- E-mail küldés: **Resend** API-n keresztül (fejlesztői környezetben konzolra logol, nem küld valódi levelet)
- Automatizált háttérfolyamatok: **Vercel Cron Jobs** (naponta/hetente lefutó ütemezett feladatok)
- Fájltárolás: **Vercel Blob** (privát tárhely, hitelesített proxy-n keresztül szolgálja ki a fájlokat)

---

## 3. Felhasználói szerepkörök

Három szerepkör van, amerre minden jogosultság épül:

| Szerepkör | Mit tehet |
|---|---|
| **ADMIN** (Adminisztrátor) | Mindent lát és szerkeszthet, felhasználókat kezel, jogosultságokat oszt ki, minden admin-only oldalhoz hozzáfér |
| **AGENT** (Felhasználó) | A normál, dolgozó kolléga szintje — jegyeket kezel, saját privát feladatai vannak, naptárat lát/szerkeszt a jogosultságától függően |
| **READER** (Olvasó) | Csak megtekintési jog — nem hozhat létre, nem módosíthat semmit, még saját magának sem küldhet emlékeztetőt stb. |

Emellett van egy **egyedi, felhasználónkénti jogosultság-rendszer** is (nem csak a három nagy szerepkör), amivel egy ADMIN finomhangolhatja, hogy egy adott AGENT pontosan mit tehet:
- Irodai hetes beosztás újragenerálása
- E-mail értesítési beállítások módosítása (másoknak is)
- Meghívó küldése új kollégának
- Feladatok törlése
- Hozzászólások törlése
- Kategóriák kezelése

Ezen felül minden felhasználó saját magának be tud állítani **e-mail értesítési preferenciákat** (mely eseménytípusokról szeretne értesítést kapni), és van egy „ne vegyen részt az irodai hetes rotációban” opció is.

---

## 4. Fő modul: Feladatkezelés (Ticketing rendszer)

Ez a rendszer gerince — klasszikus ügyfélszolgálati/support-jegy logika, de a csapat belső feladataira szabva.

### Egy feladat (ticket) adatai
- **Cím**, **leírás** (gazdag szövegszerkesztővel — félkövér, dőlt, listák, idézetek, kódblokk stb.)
- **Státusz**: Nyitott → Folyamatban → Várakozik → Lezárt
- **Prioritás**: Alacsony / Közepes / Magas / Kritikus
- **Kategória** (admin által kezelhető, testreszabható lista, pl. „Site Admin”, „WFMS”)
- **Felelős** (kire van kiosztva) és **Kiosztotta/Létrehozta** (ki hozta létre)
- **Kiemelés** (pin) — fontos jegyek a lista tetejére húzhatók
- **Csatolmányok** — max. 5 MB/fájl, max. 5 fájl/feladat, képeknél beépített képnézegető (lightbox), a fájlok csak megnyitáskor töltődnek be (nem terhelik feleslegesen az oldalt)
- **Hozzászólások** — nyilvános és **belső** (csak a csapat látja, az ügyfél/külső fél nem — bár jelenleg ez inkább „csak kollégáknak látható” jegyzet funkcióként működik)
- **@említés** hozzászólásokban — begépelve egy kollégát megemlíthetsz, ő értesítést kap
- **Tevékenységnapló** minden jegyen — ki, mikor, mit változtatott (státusz, prioritás, felelős, kategória), időrendben

### Lista- és szűrőfunkciók
- Keresés cím/leírás szerint
- Szűrés kategória, státusz, prioritás, felelős szerint
- „Lezárt feladatok mutatása” kapcsoló
- **A beállított szűrők fiókszinten elmentődnek** — legközelebbi bejelentkezéskor is megmaradnak, „Szűrők törlése” gombbal visszaállíthatók
- A szűrő-legördülők sorrendje a lista oszlopstruktúráját követi
- **Automatikus frissítés**: a lista 20 másodpercenként, a jegy részletnézete 15 másodpercenként frissül — ha valaki közben módosít vagy hozzászól, nem kell kézzel frissíteni

### Emlékeztetők (nudge)
Egy kollégának, akinek ki van osztva egy jegy, küldhetsz egy „emlékeztető” e-mailt egy kattintással (harang ikon) — mind a jegy-listáról, mind a jegy részletoldaláról, megerősítő ablakkal. Csak akkor jelenik meg, ha nem te vagy a felelős.

### Piszkozatok (draft)
Ha új jegyet kezdesz írni, de félbehagyod, a rendszer **automatikusan menti piszkozatként**. A piszkozatok később visszatölthetők és folytathatók, vagy törölhetők — nem vész el a félig megírt szöveg.

### Sablon válaszok (Saved Replies)
Gyakran ismétlődő hozzászöveg-sablonok, amiket egy kattintással be lehet illeszteni egy hozzászóláshoz. Ezek kezelése a Beállítások oldalon történik.

### Prioritás-alapú automatikus emlékeztetők
Naponta lefutó háttérfolyamat figyeli az **el nem mozdult** (nyitott, nem frissült) jegyeket, és a prioritásuktól függő idő után e-mailben emlékezteti a felelőst:

| Prioritás | Emlékeztető ha ennyi ideig nincs mozgás |
|---|---|
| Kritikus | 24 óra |
| Magas | 72 óra |
| Közepes | 168 óra (7 nap) |
| Alacsony | 336 óra (14 nap) |

„Mozgás” = bármilyen mezőváltozás VAGY új hozzászólás — tehát amin aktívan dolgoznak, arra nem küld feleslegesen emlékeztetőt. Ha a jegy továbbra sem mozdul, az emlékeztető megismétlődik. Ha nincs felelőse a jegynek, a létrehozó kapja az értesítést.

---

## 5. Fő modul: Privát feladatmenedzsment

Ez a rendszer egyik legkomplexebb, legutóbb épített része — egy **teljesen privát**, személyes Kanban-tábla minden felhasználónak, amit **senki más nem lát, még az adminisztrátor sem**.

### Alapkoncepció
Minden felhasználó saját, négy oszlopos Kanban-tábláján (**Teendő → Folyamatban → Elakadt → Kész**) vezetheti a saját, apró munkatételeit — olyan mikrofeladatokat, amik nem érdemesek egy önálló nyilvános jegyre, vagy egy nagyobb nyilvános jegy belső lebontását szolgálják.

### Kapcsolat a nyilvános jegyekkel
Egy privát feladat opcionálisan **hozzáköthető egy nyilvános jegyhez**, aminek a felhasználó a felelőse (csak nyitott jegyekhez, csak amíg ő a felelős). Egy nyilvános jegyhez **több privát feladat is** köthető (ha egy nagyobb projektet több lépésre bont valaki).

Amikor hozzákötsz egy privát feladatot egy nyilvános jegyhez, a nyilvános jegy oldalán megjelenik egy diszkrét jelzés a kollégáknak:
> 🔒 **[Név]** privát feladatmenedzsmenten belül foglalkozik ezzel a feladattal. Utolsó frissítés: [dátum]
> Teendő 1 · Folyamatban 2

Ez **kizárólag** a felelős nevét, az utolsó frissítés időpontját és a fázisonkénti darabszámot mutatja — a privát feladatok tartalmát (cím, leírás, megjegyzések) senki más nem látja.

### Automatikus státusz-szinkronizálás
- Ha egy kapcsolt privát feladatot a **Folyamatban** oszlopba húzol, a hozzá tartozó nyilvános jegy státusza is automatikusan **Folyamatban**-ra vált (csak ha korábban Nyitott vagy Várakozó volt — lezárt jegyet nem nyit újra).
- Ha egy kapcsolt privát feladatot **Kész**-be húzol, a rendszer megkérdezi: *„Lezárod a publikus feladatot is?”* — **Igen** esetén lezárja a jegyet és emlékeztet, hogy érdemes megjegyzést hagyni a kollégáknak a megoldásról; **Kihagyás** esetén csak a privát feladat lesz kész, a nyilvános jegy változatlan marad.
- Ezek a változások a nyilvános jegy tevékenységnaplójában is megjelennek, és a szokásos módon értesítik a jegy létrehozóját.

### „Felveszem a privát feladataim közé” gomb
Egy nyilvános jegy oldalán, ha te vagy a felelős, egy gombbal létrehozhatsz belőle egy privát feladatot — a cím, leírás (HTML-formázástól megtisztítva, egyszerű szövegként) és prioritás automatikusan átmásolódik, a Teendő oszlopba kerül. Ha már van kapcsolt privát feladatod, a gomb jelzi ezt, és újbóli hozzáadás előtt megerősítést kér.

### Haladás-megjegyzések
Minden privát feladathoz fűzhetsz saját, privát megjegyzéseket („Haladás” szekció) — ezek is csak a tulajdonosnak láthatók, de a megjegyzés írása frissíti a nyilvános jegyen látszó „utolsó frissítés” dátumot.

### Határidő és emlékeztető
Egy privát feladathoz határidő adható, és opcionálisan egy **e-mail emlékeztető** (a határidő napján / 1 / 2 / 3 nappal / 1 héttel előtte). Egy naponta lefutó háttérfolyamat ellenőrzi ezt, és a megfelelő napon egyszer e-mailt küld — csak a tulajdonosnak, csak a cím és a határidő szerepel benne (a tartalom privát marad).

### Archívum
A **Kész** oszlopban lévő feladatok kézzel archiválhatók (kikerülnek az aktív tábláról). Az archívum **év/hónap szerint csoportosítva**, lenyitható/becsukható szekciókban jeleníti meg a megoldott feladatokat (a legfrissebb hónap alapból nyitva). Egy archivált feladatra kattintva megnyílik a **teljes életciklus-történet**: mikor jött létre, milyen oszlopváltásokon ment át (időbélyeggel), milyen megjegyzések születtek hozzá, mikor archiválták — mindez egyetlen időrendi listában.

### Adatbiztonsági modell
- Minden privát feladat és megjegyzés lekérdezése szigorúan a tulajdonos `userId`-jára szűrve történik — **nincs admin felülbírálás** a kódban
- Ha valaki (akár admin) megpróbál elérni egy nem sajsome privát feladatot az azonosítója alapján, a válasz `404 — nem található`, nem `403 — tiltva` (így az sem derül ki, hogy létezik-e egyáltalán)
- A nyilvános jegyen megjelenő jelzés kizárólag aggregált adat (név + dátum + darabszám), a tartalom sosem szivárog ki

---

## 6. Fő modul: Naptár

Egy közös csapatnaptár négy réteggel, amik egymásra vetülnek egy hónap-nézetben:

### Szűrőnapok (bolti beosztás)
A csapat egy külső **Google Sheets** táblázatból szinkronizálja a bolti „szűrőnap” (kirendelt munkanap) beosztásokat — bolt neve, helyszín, időpont, kapcsolattartó, kinek van kiosztva vagy hogy valaki saját magának vitte fel. A szinkron **naponta automatikusan** lefut (06:00 UTC), és admin kézzel is bármikor újraindíthatja. A törölt/áthúzott sorok és egyedi háttérszínek is átjönnek a táblázatból.

### Irodai hetes
Heti rotációban valaki „irodai hetes” — a rendszer automatikusan generálja a beosztást a csapat aktív, rotációból ki nem zárt tagjai között, de admin kézzel is felülírhatja egy adott hétre. Minden hétfőn e-mail emlékezteti az aktuális hetest a feladataira (konyha rendben tartása, mosogatógép, kuka stb.).

### Szabadságok
Bárki rögzítheti a saját szabadságát (kezdő/záró dátum, megjegyzés). **Adminisztrátor más felhasználónak is rögzíthet szabadságot** — ez azért fontos, mert ha valaki csak e-mailben jelzi a távollétét, de nem viszi fel saját magának a rendszerbe, az admin pótolhatja helyette.

### Egyéb naptáresemények
Szabadon létrehozható események (cím, leírás, dátum), opcionális e-mail értesítéssel a kiválasztott kollégáknak vagy mindenkinek.

### Vezérlőpult-integráció
A vezérlőpult tetején egy „mai nap” csík mutatja az aznapi szűrőnapokat, irodai hetest és szabadságon lévőket egyetlen pillantásra.

---

## 7. Adminisztrációs funkciók

### Munkatársak kezelése
- Meghívó küldése új kollégának (e-mailben, token-alapú regisztrációs linkkel)
- Szerepkör-váltás, jogosultságok finomhangolása felhasználónként
- Online státusz kijelzés („Most online” / „Utoljára X ideje online” — 2 perces heartbeat-alapú mechanizmus)
- Felhasználó törlése/letiltása

### Napló (Log)
Egyesített admin-only nézet, ami két adatforrást fésül össze időrendben:
- **Tevékenységnapló** — minden jegyen történt változás (státusz, prioritás, felelős, hozzászólás stb.)
- **Rendszernapló (audit log)** — bejelentkezések, profilmódosítások, szerepkör-változások, meghívók, felhasználó-törlések, és a privát feladatokkal kapcsolatos **tartalom nélküli** eseményjelzések (pl. „privát feladat létrehozva”, de a tartalma nélkül)

Szűrhető felhasználó és típus szerint, 20 másodpercenként automatikusan frissül.

### Changelog (Újdonságok)
Admin által szerkeszthető, verziózott changelog-bejegyzések (`v1.1` formátum, egyszerű Markdown-szerű jelöléssel: `##` cím, `-` lista, `**félkövér**`). Közzétételkor **e-mail értesítő** küldhető a kollégáknak — kiválasztva „Mindenki”, „Csak a kiválasztottak”, vagy „Mindenki, kivéve a kiválasztottakat” módban. Meglévő bejegyzéshez utólag is küldhető (újra)értesítő, célzottan azoknak, akik esetleg lemaradtak róla (pl. egy korábbi technikai hiba miatt).

---

## 8. Értesítési rendszer

Kétrétegű:
1. **Rendszeren belüli harang-értesítések** (Értesítések oldal) — jegyekhez kötött események
2. **E-mail értesítések** — a legtöbb esemény típushoz külön beállítható, hogy a felhasználó kéri-e:
   - Új jegy létrehozása / hozzá van rendelve
   - Új hozzászólás egy jegyéhez
   - Jegy adatainak módosítása
   - Emlékeztető (nudge) küldése
   - Naptáresemények (szűrőnap, irodai hetes, egyéb — külön-külön kapcsolható)
   - Szerepkör-változás
   - Prioritás-alapú automatikus emlékeztető
   - Privát feladat határidő-emlékeztető
   - Changelog-értesítő
   - Irodai hetes heti emlékeztető

Minden e-mail egységes, saját arculatú HTML-sablonban megy ki, a myBatz brand-színével (`#6C5CE7` lila).

---

## 9. Automatizált háttérfolyamatok (Cron jobs)

Négy ütemezett feladat fut az éles rendszeren (Vercel Cron, UTC időzónában):

| Feladat | Ütemezés | Mit csinál |
|---|---|---|
| `sync-shifts` | naponta 06:00 | Google Sheets szűrőnap-adatok szinkronizálása |
| `priority-reminders` | naponta 08:00 | El nem mozdult jegyek emlékeztetője prioritás szerint |
| `private-task-reminders` | naponta 08:10 | Privát feladatok határidő-emlékeztetői |
| `office-week-reminder` | hétfőnként 07:15 | Aktuális irodai hetes e-mail emlékeztetője |

---

## 10. Fájlkezelés

Csatolmányok (jegyekhez és hozzászólásokhoz) **privát** Vercel Blob tárhelyen tárolódnak — nem publikusan elérhető URL-ek, hanem egy **hitelesített szerveroldali proxy**-n keresztül szolgálja ki őket a rendszer, csak bejelentkezett felhasználóknak. Korlátok: max. 5 MB/fájl, max. 5 fájl feladatonként. Képeknél beépített lightbox (képnézegető) van, ami csak megnyitáskor tölti be a képet, hogy ne pazaroljon adatforgalmat.

---

## 11. Felület és UX-elvek, amik a fejlesztés során kialakultak

- **Magyar nyelvű felület**, tegező, közvetlen hangnem
- **Becenév-elsőbbség**: ha valakinek be van állítva becenév, mindenhol az jelenik meg a teljes név helyett (kivéve a köszöntő üzenetben és e-mail megszólításban, ahol amúgy is a keresztnév/becenév a természetes)
- **Teljes név megkülönböztetéshez**: ha két embernek ugyanaz a beceneve/keresztneve, automatikusan a teljes nevükre vált a rendszer az egyértelműség kedvéért
- **Mobilbarát**: a privát feladatok tábla és más nézetek reszponzívan alkalmazkodnak kis képernyőn (pl. a szűrősáv vízszintesen görgethető chipsorrá alakul)
- **Optimista UI**: sok művelet (drag&drop, kedvencnek jelölés) azonnal frissíti a felületet, majd a háttérben menti — hiba esetén visszaáll
- **Megerősítő ablakok** minden visszafordíthatatlan műveletnél (törlés, jegy lezárása privát feladatból stb.)
- **Sötét/világos téma automatikus követése** (rendszerbeállítás szerint)

---

## 12. Fejlesztési filozófia (ha releváns a beszélgetéshez)

A rendszer egy folyamatosan, iteratívan bővülő éles termék — minden új funkció előtt alapos kódfeltérképezés, tervezés, majd **helyi teszt-adatbázison és böngészőben végigtesztelt** implementáció történik, mielőtt bármi az éles Neon adatbázisra kerülő migrációval vagy `git push`-sal élesedik. Az adatbázis-migrációk mindig kézzel írt SQL-ként készülnek (soha nem automatagenerált `prisma migrate dev` az éles adatbázis ellen), és minden push előtt kötelező a TypeScript-ellenőrzés (`tsc --noEmit`) és a teljes production build (`next build`) lefuttatása — mivel ez egy éles rendszer, amit kollégák nap mint nap használnak.
