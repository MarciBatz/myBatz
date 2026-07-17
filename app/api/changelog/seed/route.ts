import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return unauthorizedResponse()
  if (session.role !== 'ADMIN') return forbiddenResponse()

  const existing = await prisma.changelogEntry.count()
  if (existing > 0) return NextResponse.json({ ok: true, skipped: true, message: 'Már van bejegyzés' })

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { firstName: true, nickname: true, name: true },
  })
  const authorName = user?.nickname || user?.firstName || user?.name || 'Marci'

  await prisma.changelogEntry.create({
    data: {
      version: 'v1.0',
      title: 'Naptár, jogosultságok, és egyéb fejlesztések',
      authorId: session.id,
      authorName,
      publishedAt: new Date('2026-07-17'),
      content: `## Új funkciók

### Naptár modul
- Szűrőnapok Google Sheets-ből automatikusan szinkronizálódnak — a Frissítés gombbal bármikor frissíthető
- Elmaradt szűrőnapok (áthúzott cellák a táblázatban) halványabban jelennek meg a naptárban
- A Google Sheets cella háttérszíne megjelenik a naptáron az egyes szűrőnap bejegyzéseknél
- Irodai hetes rendszer: automatikus hetenkénti rotáció az aktív munkatársak között
- Az adminisztrátor manuálisan is küldhet értesítő e-mailt a hetes személynek
- Szabadságok fül: szabadságok rögzítése és megtekintése
- Egyéb naptáresemények létrehozásakor opcionálisan e-mail értesítő küldhető — kiválasztott személyeknek vagy mindenkinek
- A Naptár menüpont minden munkatársnak elérhető (nem csak adminisztrátoroknak)
- Vezérlőpult tetején megjelenik az aznapi naptárbejegyzések összefoglalója (szűrőnapok, irodai hetes, szabadságok, egyéb)

### Jogosultsági rendszer
- Adminisztrátori jog nélkül is adhatók egyéni jogosultságok: meghívó küldése, irodai beosztás újragenerálása, felhasználói beállítások kezelése, ticketek törlése, hozzászólások törlése, kategóriák kezelése
- A Munkatársak oldalon fogaskerék ikonnal érhető el a jogosultság- és preferencia-szerkesztő modal

### Egyéni profil beállítások
- E-mail értesítési preferenciák személyenként szabályozhatók: ticket értesítések, @megemlítés, irodai hetes, naptár egyéb esemény
- Egyes munkatársak kizárhatók az irodai rotációból

### Ticketek
- Lezárt ticketek megjelenítése be/kikapcsolható a vezérlőpulton (alapból látszódnak)

### Megjegyzések
- Jogosultsággal rendelkező felhasználók törölhetik a megjegyzéseket

### Munkatársak kezelése
- Ha két munkatársnak azonos a keresztneve (pl. Kiss Anita, Hegyváriné Anita), a rendszer mindenhol a teljes nevüket jeleníti meg

### Kategóriák
- Nem csak adminisztrátor, hanem az arra jogosult felhasználó is kezelheti a kategóriákat

## Hibajavítások

- **Irodai rotáció**: a kizárás visszavonása után a munkatárs ismét bekerül a beosztásba
- **Szinkronizáció**: az egyjegyű hónapot vagy napot tartalmazó dátumok (pl. 2026.7.5.) korábban kiestek — javítva
- **Szinkronizáció**: az össze-vissza beírt sorok (nem csak az utolsó sor) is szinkronizálódnak
- **Beállítások oldal**: a Kategóriák kezelése jogosultsággal rendelkező felhasználó számára megjelenik a kategóriaszerkesztő
- **Munkatársak oldal**: a jogosultsággal rendelkező felhasználók számára megjelennek a megfelelő gombok (meghívó, beosztás-újragenerálás, fogaskerék)`,
    },
  })

  return NextResponse.json({ ok: true, created: true })
}
