# SpesaTracker - Roadmap Sviluppi Futuri

Questo file raccoglie tutte le idee e funzionalità da implementare in futuro.

---

## v1.5 - Miglioramenti Core

### Autenticazione
- [ ] Recupero password via email
- [ ] Verifica email alla registrazione
- [ ] "Ricordami" per sessioni più lunghe
- [ ] Login con Google/Apple (OAuth)

### Budget & Controllo
- [ ] Budget mensile per categoria
- [ ] Alert quando si supera il budget
- [ ] Budget annuale complessivo
- [ ] Obiettivi di risparmio

### Filtri & Ricerca
- [ ] Filtro per range di date personalizzato
- [ ] Ricerca testuale nelle descrizioni
- [ ] Filtro per importo (min/max)
- [ ] Tag personalizzati sulle spese

### Export & Backup
- [ ] Export automatico periodico (settimanale/mensile)
- [ ] Export in PDF con grafici
- [ ] Backup su Google Drive/Dropbox

---

## v2.0 - Integrazione Bancaria

### Nordigen/GoCardless Bank Sync
- [x] Collegamento conto bancario
- [x] Import movimenti (sync manuale)
- [x] Categorizzazione automatica basata su storico
- [ ] **Sync automatico giornaliero** (Cloudflare Cron Triggers) - priorità alta
- [ ] **Deduplicazione Excel vs Bank** - match per data+importo+descrizione - priorità alta
- [ ] Riconciliazione spese manuali vs bancarie
- [x] Supporto multi-conto
- [ ] Notifica quando collegamento sta per scadere (90 giorni)

### Multi-Utente Avanzato
- [ ] Condivisione budget familiare
- [ ] Spese condivise tra utenti
- [ ] Ruoli (admin, membro famiglia, ospite)
- [ ] Inviti via email

---

## v3.0 - Intelligenza Artificiale

### Analisi AI
- [ ] Categorizzazione automatica con AI
- [ ] Previsione spese fine mese
- [ ] Suggerimenti per risparmiare
- [ ] Rilevamento anomalie (spese insolite)
- [ ] Report mensile generato da AI
- [ ] Chat assistant per query sui dati ("quanto ho speso in ristoranti a dicembre?")

### Machine Learning
- [ ] Pattern di spesa ricorrenti
- [ ] Clustering automatico spese simili
- [ ] Previsione budget ottimale per categoria

---

## Miglioramenti UX/UI

- [ ] Dark mode
- [ ] Temi colore personalizzabili
- [ ] Widget per home screen (iOS/Android)
- [ ] Notifiche push per promemoria
- [ ] Shortcut Siri/Google Assistant
- [ ] Modalità offline completa (PWA)
- [ ] Gesture personalizzate (swipe per azioni rapide)

---

## Infrastruttura & Admin

- [ ] Pannello admin per gestire utenti
- [ ] Metriche utilizzo app
- [ ] Rate limiting API
- [ ] Logs e audit trail
- [ ] Multi-tenant per aziende
- [ ] API pubblica con documentazione

---

## Note

Questo file viene aggiornato man mano che emergono nuove idee.
Priorità e tempistiche da definire in base alle esigenze.

*Ultimo aggiornamento: Gennaio 2026*
