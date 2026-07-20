'use client'

import Link from 'next/link'

export default function GuidePage() {
  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Vissza a myBatz felületre
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#6C5CE7' }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Funkciók és útmutató</h1>
            <p className="text-gray-500 text-sm">myBatz — Összefoglaló kézikönyv</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">

        {/* Roles */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: '#6C5CE7' }}>1</span>
            Szerepkörök és jogosultságok
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="font-semibold text-gray-900 mb-1">Adminisztrátor</p>
              <p className="text-sm text-gray-600">Teljes hozzáférés: felhasználók kezelése, kategóriák létrehozása, minden feladat megtekintése és módosítása, összes beállítás elérése, changelog kezelése.</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="font-semibold text-gray-900 mb-1">Felhasználó (Agent)</p>
              <p className="text-sm text-gray-600">Feladatok létrehozása és kezelése, megjegyzések fűzése, felelős jelölése, sablon válaszok szerkesztése. Egyéni jogosultságokkal bővíthető.</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="font-semibold text-gray-900 mb-1">Olvasó (Reader)</p>
              <p className="text-sm text-gray-600">Kizárólag megtekintési jog: a feladatokat látja, de nem módosíthatja azokat.</p>
            </div>
          </div>
          <div className="bg-indigo-50 rounded-lg px-4 py-3 text-sm text-indigo-800">
            <strong>Egyéni jogosultságok (Agent szintű felhasználóknak adható):</strong>
            <ul className="mt-2 space-y-1">
              {[
                'Meghívó küldése — új munkatárs meghívása e-mailben',
                'Irodai beosztás újragenerálása — jövőbeli hetek újraosztása',
                'Felhasználói beállítások kezelése — mások preferenciáinak és jogosultságainak szerkesztése',
                'Feladatok törlése — feladat végleges eltávolítása',
                'Hozzászólások törlése — megjegyzések törlése feladatokon',
                'Kategóriák kezelése — kategóriák létrehozása és törlése',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2"><span className="mt-0.5">•</span><span>{item}</span></li>
              ))}
            </ul>
          </div>
        </section>

        {/* Tickets */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: '#6C5CE7' }}>2</span>
            Feladatok kezelése
          </h2>
          <div className="space-y-3 text-sm text-gray-700">
            <p>A feladat a rendszer alapegysége: egy tennivaló, kérés vagy probléma nyomon követésére szolgál.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div>
                <p className="font-medium text-gray-900 mb-2">Feladat létrehozásakor megadható:</p>
                <ul className="space-y-1 text-gray-600">
                  {['Cím és részletes leírás (szövegformázással)', 'Kategória és prioritás (Alacsony / Közepes / Magas / Kritikus)', 'Felelős személy hozzárendelése', 'Fájlmelléklet csatolása'].map((item, i) => (
                    <li key={i} className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-2">Státuszok:</p>
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 mr-1">Nyitott</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 mr-1">Folyamatban</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 mr-1">Várakozik</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Lezárt</span>
                </div>
                <p className="font-medium text-gray-900 mb-1 mt-4">Lezárt feladatok megjelenítése:</p>
                <p className="text-gray-600 text-sm">A vezérlőpulton egy gombbal be- és kikapcsolható, hogy látszódjanak-e a lezárt feladatok. Alapból látszódnak.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Comments */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: '#6C5CE7' }}>3</span>
            Megjegyzések és szövegformázás
          </h2>
          <div className="space-y-3 text-sm text-gray-700">
            <p>Minden feladat alatt megjegyzések fűzhetők, amelyek visszajelzést, státuszfrissítést vagy belső jegyzetet tartalmaznak.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="font-medium text-gray-900 mb-2">Szövegformázási lehetőségek:</p>
                <ul className="space-y-1 text-gray-600">
                  {['Félkövér, dőlt, aláhúzott szöveg', 'Fejlécek (H2, H3), felsorolás, számozott lista', 'Idézet (blockquote) és kódblokk', 'Szövegigazítás (bal / közép / jobb)'].map((item, i) => (
                    <li key={i} className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-2">@Megemlítés:</p>
                <p className="text-gray-600">Írd be a <code className="bg-gray-100 px-1 rounded text-xs">@</code> karaktert, majd a munkatárs nevét. A megjelenő listából kattintva illeszd be — az érintett értesítést kap e-mailben.</p>
                <p className="font-medium text-gray-900 mb-1 mt-3">Megjegyzés törlése:</p>
                <p className="text-gray-600">Az erre jogosult felhasználó a megjegyzés mellett megjelenő kuka ikonnal törölheti azt. A törlés megerősítést kér.</p>
              </div>
            </div>
            <div className="bg-indigo-50 rounded-lg px-4 py-3 mt-2 text-indigo-800 text-sm">
              <strong>Belső megjegyzés:</strong> Csak az Adminisztrátor és Felhasználó szerepkörű tagok látják — az Olvasó jogosultsággal rendelkező felhasználók nem.
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: '#6C5CE7' }}>4</span>
            Értesítések
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-700">
            <div>
              <p className="font-medium text-gray-900 mb-2">E-mail értesítések küldési esetei:</p>
              <ul className="space-y-1 text-gray-600">
                {['Új feladat létrehozásakor a felelősnek', 'Megjegyzés hozzáadásakor az érintetteknek', 'Státusz- vagy prioritásváltáskor', '@megemlítéskor az érintett felhasználónak', 'SLA átlépésekor emlékeztető a felelősnek', 'Irodai hetes értesítő (hétfőnként automatikusan)', 'Naptár egyéb esemény — ha a létrehozó értesítőt küld'].map((item, i) => (
                  <li key={i} className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-2">Harangozó (Nudge) funkció:</p>
              <p className="text-gray-600 mb-3">Ha egy feladat felelőse nem reagál, a csengő ikonra kattintva emlékeztetőt küldhetsz neki e-mailben.</p>
              <p className="font-medium text-gray-900 mb-2">SLA-figyelés (48 óra):</p>
              <p className="text-gray-600 mb-3">Ha a felelős 48 órán belül nem reagál, a rendszer automatikusan emlékeztető e-mailt küld.</p>
              <p className="font-medium text-gray-900 mb-2">Egyéni értesítési preferenciák:</p>
              <p className="text-gray-600">Mindenki a saját profiljában kapcsolhatja ki/be az egyes értesítési típusokat (feladat, megemlítés, irodai hetes, naptár egyéb esemény).</p>
            </div>
          </div>
        </section>

        {/* Calendar */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: '#6C5CE7' }}>5</span>
            Naptár
          </h2>
          <p className="text-sm text-gray-600 mb-4">A Naptár menüpont minden munkatársnak elérhető. Havi nézetben mutatja az összes eseményt.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-700">
            <div>
              <p className="font-medium text-gray-900 mb-2">Szűrőnapok (Google Sheets szinkron):</p>
              <ul className="space-y-1 text-gray-600">
                {['A bejegyzések a Google Sheets táblázatból szinkronizálódnak', 'Frissítés gombbal bármikor szinkronizálható', 'Elmaradt szűrőnapok (áthúzott sorok) halványabban jelennek meg', 'A cella háttérszíne megjelenik a naptáron is'].map((item, i) => (
                  <li key={i} className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-2">Irodai hetes rendszer:</p>
              <ul className="space-y-1 text-gray-600 mb-3">
                {['Automatikus hetenkénti rotáció a munkatársak között', 'Kizárható egyes munkatárs a rotációból (profil beállításokban)', 'Az adminisztrátor manuálisan is küldhet értesítő e-mailt', 'Újragenerálható a jövőbeli beosztás (jogosultság szükséges)'].map((item, i) => (
                  <li key={i} className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span>{item}</li>
                ))}
              </ul>
              <p className="font-medium text-gray-900 mb-2">Egyéb naptáresemények és szabadságok:</p>
              <ul className="space-y-1 text-gray-600">
                {['Egyéb esemény létrehozásakor opcionálisan e-mail értesítő küldhető kiválasztott személyeknek vagy mindenkinek', 'Szabadságok rögzíthetők és megtekinthetők'].map((item, i) => (
                  <li key={i} className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="bg-teal-50 rounded-lg px-4 py-3 mt-4 text-teal-800 text-sm">
            <strong>Vezérlőpult sáv:</strong> A vezérlőpult tetején minden nap megjelenik az aznapi naptárbejegyzések összefoglalója (szűrőnapok, irodai hetes, szabadságok, egyéb események).
          </div>
        </section>

        {/* Team */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: '#6C5CE7' }}>6</span>
            Munkatársak kezelése
          </h2>
          <div className="space-y-3 text-sm text-gray-700">
            <p>Az adminisztrátor (vagy megfelelő jogosultságú felhasználó) hívhatja meg az új munkatársakat e-mail-cím alapján.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="font-medium text-gray-900 mb-2">Meghíváskor megadható:</p>
                <ul className="space-y-1 text-gray-600">
                  {['Teljes név és szerepkör', 'Ideiglenes jelszó', 'Meghívó e-mail küldésének be/kikapcsolása'].map((item, i) => (
                    <li key={i} className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-2">Fogaskerék ikon (Munkatársak oldal):</p>
                <p className="text-gray-600">Az adminisztrátor a munkatárs mellett lévő fogaskerék ikonra kattintva szerkesztheti az egyéni jogosultságokat, e-mail preferenciákat, és kizárhatja a személyt az irodai rotációból.</p>
              </div>
            </div>
            <div className="bg-amber-50 rounded-lg px-4 py-3 text-amber-800 text-sm">
              <strong>Névegyértelműsítés:</strong> Ha két munkatársnak azonos a keresztneve (pl. Kiss Anita, Hegyváriné Anita), a rendszer mindenhol a teljes nevüket jeleníti meg.
            </div>
          </div>
        </section>

        {/* Saved Replies */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: '#6C5CE7' }}>7</span>
            Sablon válaszok
          </h2>
          <p className="text-sm text-gray-700">Minden felhasználónak saját sablon válasz gyűjteménye van. Ezek az előre megírt szövegrészletek egyetlen kattintással beilleszthetők a megjegyzésekbe, gyorsítva a visszajelzést. Mindenki csak a saját sablonjait látja és szerkesztheti.</p>
        </section>

        {/* Settings */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: '#6C5CE7' }}>8</span>
            Beállítások
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
            <div>
              <p className="font-medium text-gray-900 mb-2">Profil szerkesztése:</p>
              <ul className="space-y-1 text-gray-600">
                {['Vezetéknév, keresztnév, becenév megadása', 'Avatar kép URL beállítása', 'Jelszó megváltoztatása'].map((item, i) => (
                  <li key={i} className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span>{item}</li>
                ))}
              </ul>
              <p className="mt-2 text-gray-500 text-xs">Ha becenév van megadva, az jelenik meg mindenhol. A profilkép kezdőbetűje: becenév &gt; keresztnév &gt; vezetéknév.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-2">E-mail értesítési preferenciák:</p>
              <p className="text-gray-600 mb-3">Mindenki a saját beállításaiban kapcsolhatja ki/be az egyes értesítési típusokat: feladat értesítések, @megemlítés, irodai hetes, naptár egyéb esemény.</p>
              <p className="font-medium text-gray-900 mb-2">Kategóriák:</p>
              <p className="text-gray-600">Az adminisztrátor és az arra jogosult felhasználó létrehozhatja és törölheti a feladat-kategóriákat.</p>
            </div>
          </div>
        </section>

        {/* Activity Log */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: '#6C5CE7' }}>9</span>
            Tevékenységnapló
          </h2>
          <p className="text-sm text-gray-700">A <strong>Tevékenységek</strong> menüpont alatt megtekinthető az összes esemény: ki, mikor, mit változtatott. Szűrhető felhasználó szerint. Minden feladaton belül is megjelenik a saját tevékenységtörténet: státuszváltások, megjegyzések, emlékeztetők, felelős-változások.</p>
        </section>

        <div className="text-center py-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors" style={{ background: '#6C5CE7' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Vissza a myBatz felületre
          </Link>
        </div>
      </div>
    </div>
  )
}
