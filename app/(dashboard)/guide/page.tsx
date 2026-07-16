'use client'

import Link from 'next/link'

export default function GuidePage() {
  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Vissza a myBatz Task felületre
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
            <p className="text-gray-500 text-sm">myBatz Task — Összefoglaló kézikönyv</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">

        {/* Roles */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: '#6C5CE7' }}>1</span>
            Szerepkörök
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="font-semibold text-gray-900 mb-1">Adminisztrátor</p>
              <p className="text-sm text-gray-600">Teljes hozzáférés: felhasználók kezelése, kategóriák létrehozása, minden ticket megtekintése és módosítása, összes beállítás elérése.</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="font-semibold text-gray-900 mb-1">Felhasználó (Agent)</p>
              <p className="text-sm text-gray-600">Ticketek létrehozása és kezelése, megjegyzések fűzése, felelős jelölése, sablon válaszok szerkesztése.</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="font-semibold text-gray-900 mb-1">Olvasó (Reader)</p>
              <p className="text-sm text-gray-600">Kizárólag megtekintési jog: a ticketeket látja, de nem módosíthatja azokat.</p>
            </div>
          </div>
        </section>

        {/* Tickets */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: '#6C5CE7' }}>2</span>
            Ticketek kezelése
          </h2>
          <div className="space-y-3 text-sm text-gray-700">
            <p>A ticket a rendszer alapegysége: egy feladat, kérés vagy probléma nyomon követésére szolgál.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div>
                <p className="font-medium text-gray-900 mb-2">Ticket létrehozásakor megadható:</p>
                <ul className="space-y-1 text-gray-600">
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> Cím és részletes leírás (szövegformázással)</li>
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> Kategória és prioritás (Alacsony / Közepes / Magas / Kritikus)</li>
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> Felelős személy hozzárendelése</li>
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> Fájlmelléklet csatolása</li>
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
              </div>
            </div>
          </div>
        </section>

        {/* Comments & Rich Text */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: '#6C5CE7' }}>3</span>
            Megjegyzések és szövegformázás
          </h2>
          <div className="space-y-3 text-sm text-gray-700">
            <p>Minden ticket alatt megjegyzések fűzhetők, amelyek visszajelzést, státuszfrissítést vagy belső jegyzetet tartalmaznak.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="font-medium text-gray-900 mb-2">Szövegformázási lehetőségek:</p>
                <ul className="space-y-1 text-gray-600">
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> <strong>Félkövér</strong>, <em>dőlt</em>, aláhúzott szöveg</li>
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> Fejlécek (H2, H3), felsorolás, számozott lista</li>
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> Idézet (blockquote) és kódblokk</li>
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> Szövegigazítás (bal / közép / jobb)</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-2">@Megemlítés:</p>
                <p className="text-gray-600">Írd be a <code className="bg-gray-100 px-1 rounded text-xs">@</code> karaktert, majd a munkatárs nevét. A megjelenő listából kattintva illeszd be a megemlítést — az érintett értesítést kap e-mailben.</p>
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
                <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> Új ticket létrehozásakor a felelősnek</li>
                <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> Megjegyzés hozzáadásakor az érintetteknek</li>
                <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> Státusz- vagy prioritásváltáskor</li>
                <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> @megemlítéskor az érintett felhasználónak</li>
                <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> SLA átlépésekor emlékeztető a felelősnek</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-2">Harangozó (Nudge) funkció:</p>
              <p className="text-gray-600 mb-3">Ha egy ticket felelőse nem reagál, a csengő ikonra kattintva emlékeztetőt küldhetsz neki e-mailben. A rendszer megerősítést kér, és az eseményt a ticket tevékenységnaplójában rögzíti.</p>
              <p className="font-medium text-gray-900 mb-2">SLA-figyelés (48 óra):</p>
              <p className="text-gray-600">Ha a felelős 48 órán belül nem reagál a ticketre, a rendszer automatikusan emlékeztető e-mailt küld. Ha nincs felelős rendelve, a létrehozót értesíti.</p>
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: '#6C5CE7' }}>5</span>
            Munkatársak kezelése
          </h2>
          <div className="space-y-3 text-sm text-gray-700">
            <p>Az adminisztrátor hívhatja meg az új munkatársakat e-mail-cím alapján. A meghívó opcionálisan e-mailben is kiküldhető, de dönthet úgy is, hogy az ideiglenes jelszót személyesen adja át.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="font-medium text-gray-900 mb-2">Meghíváskor megadható:</p>
                <ul className="space-y-1 text-gray-600">
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> Teljes név és szerepkör</li>
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> Ideiglenes jelszó</li>
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> Meghívó e-mail küldésének be/kikapcsolása</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-2">Felhasználó törlése:</p>
                <p className="text-gray-600">Törléskor a korábbi ticketek és megjegyzések megmaradnak — a felhasználó neve helyén „[Törölt felhasználó]" jelenik meg.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Saved Replies */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: '#6C5CE7' }}>6</span>
            Sablon válaszok
          </h2>
          <p className="text-sm text-gray-700">Minden felhasználónak saját sablon válasz gyűjteménye van. Ezek az előre megírt szövegrészletek egyetlen kattintással beilleszthetők a megjegyzésekbe, gyorsítva a visszajelzést. Mindenki csak a saját sablonjait látja és szerkesztheti.</p>
        </section>

        {/* Settings */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: '#6C5CE7' }}>7</span>
            Beállítások
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
            <div>
              <p className="font-medium text-gray-900 mb-2">Profil szerkesztése:</p>
              <ul className="space-y-1 text-gray-600">
                <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> Vezetéknév, keresztnév, becenév megadása</li>
                <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> Avatar kép URL beállítása</li>
                <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> Jelszó megváltoztatása</li>
              </ul>
              <p className="mt-2 text-gray-500 text-xs">Ha becenév van megadva, az jelenik meg mindenhol. A profilkép kezdőbetűje: becenév &gt; keresztnév &gt; vezeteéknév.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-2">Kategóriák (admin):</p>
              <p className="text-gray-600">Az adminisztrátor létrehozhatja és törölheti a ticket-kategóriákat, amelyek a ticketek csoportosítására szolgálnak.</p>
            </div>
          </div>
        </section>

        {/* Activity Log */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: '#6C5CE7' }}>8</span>
            Tevékenységnapló
          </h2>
          <p className="text-sm text-gray-700">A <strong>Tevékenységek</strong> menüpont alatt megtekinthető az összes esemény: ki, mikor, mit változtatott. Szűrhető felhasználó szerint. Minden ticketen belül is megjelenik a saját tevékenységtörténet: státuszváltások, megjegyzések, emlékeztetők, felelős-változások.</p>
        </section>

        {/* Footer */}
        <div className="text-center py-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ background: '#6C5CE7' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Vissza a myBatz Task felületre
          </Link>
        </div>

      </div>
    </div>
  )
}
