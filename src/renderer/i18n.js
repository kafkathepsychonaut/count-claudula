// Count Claudula i18n. Loads in main (require) and in the renderer (<script> -> window.I18N).
// 37 languages. "Claude Code" is a brand, do not translate. RTL: ar/he/fa.
(function () {
  'use strict';

  const LANGS = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'pt', name: 'Português' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'it', name: 'Italiano' },
    { code: 'nl', name: 'Nederlands' },
    { code: 'pl', name: 'Polski' },
    { code: 'ru', name: 'Русский' },
    { code: 'uk', name: 'Українська' },
    { code: 'cs', name: 'Čeština' },
    { code: 'sk', name: 'Slovenčina' },
    { code: 'ro', name: 'Română' },
    { code: 'hu', name: 'Magyar' },
    { code: 'el', name: 'Ελληνικά' },
    { code: 'sv', name: 'Svenska' },
    { code: 'da', name: 'Dansk' },
    { code: 'fi', name: 'Suomi' },
    { code: 'nb', name: 'Norsk' },
    { code: 'tr', name: 'Türkçe' },
    { code: 'ca', name: 'Català' },
    { code: 'bg', name: 'Български' },
    { code: 'hr', name: 'Hrvatski' },
    { code: 'sr', name: 'Српски' },
    { code: 'lt', name: 'Lietuvių' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'zh', name: '中文' },
    { code: 'vi', name: 'Tiếng Việt' },
    { code: 'th', name: 'ไทย' },
    { code: 'id', name: 'Bahasa Indonesia' },
    { code: 'ms', name: 'Bahasa Melayu' },
    { code: 'fil', name: 'Filipino' },
    { code: 'hi', name: 'हिन्दी' },
    { code: 'ar', name: 'العربية' },
    { code: 'he', name: 'עברית' },
    { code: 'fa', name: 'فارسی' },
  ];

  const RTL = new Set(['ar', 'he', 'fa']);

  const DICT = {
    en: { five_hour: '5 hours', week: 'week', resets_in: 'resets in', resetting: 'resetting…', updated: 'updated', connecting: 'connecting…', offline: 'offline · last data', updating: 'updating…', cc_today: 'Claude Code · today', input: 'input', output: 'output', cache_read: 'cache · read', cache_write: 'cache · write', equiv_cost: 'equivalent cost', cost_note: 'Claude Code (CLI) only · ~API value, already included in your Max plan', t_detailed: 'detailed view', t_simple: 'simple view', t_expand: 'expand', t_refresh: 'refresh now', t_minimize: 'minimize', t_hide: 'hide to tray', tray_showhide: 'Show / hide', tray_expand: 'Expand panel', tray_refresh: 'Refresh now', tray_settings: 'Settings…', tray_quit: 'Quit', tray_loading: 'loading…', set_title: 'Settings', set_language: 'Language', set_lang_auto: 'Auto (system)', set_start: 'Start with system', set_close: 'Close' },
    es: { five_hour: '5 horas', week: 'semana', resets_in: 'se reinicia en', resetting: 'reiniciando…', updated: 'actualizado', connecting: 'conectando…', offline: 'sin conexión · último dato', updating: 'actualizando…', cc_today: 'Claude Code · hoy', input: 'entrada', output: 'salida', cache_read: 'caché · lectura', cache_write: 'caché · escritura', equiv_cost: 'costo equivalente', cost_note: 'solo Claude Code (CLI) · ~valor de API, ya incluido en tu plan Max', t_detailed: 'vista detallada', t_simple: 'vista simple', t_expand: 'expandir', t_refresh: 'actualizar ahora', t_minimize: 'minimizar', t_hide: 'ocultar en la bandeja', tray_showhide: 'Mostrar / ocultar', tray_expand: 'Expandir panel', tray_refresh: 'Actualizar ahora', tray_settings: 'Ajustes…', tray_quit: 'Salir', tray_loading: 'cargando…', set_title: 'Ajustes', set_language: 'Idioma', set_lang_auto: 'Automático (sistema)', set_start: 'Iniciar con el sistema', set_close: 'Cerrar' },
    pt: { five_hour: '5 horas', week: 'semana', resets_in: 'reseta em', resetting: 'resetando…', updated: 'atualizado', connecting: 'conectando…', offline: 'sem conexão · dado anterior', updating: 'atualizando…', cc_today: 'Claude Code · hoje', input: 'entrada', output: 'saída', cache_read: 'cache · leitura', cache_write: 'cache · escrita', equiv_cost: 'custo equivalente', cost_note: 'só Claude Code (CLI) · ~valor de API, já incluído no seu plano Max', t_detailed: 'modo detalhado', t_simple: 'modo simples', t_expand: 'expandir', t_refresh: 'atualizar agora', t_minimize: 'minimizar', t_hide: 'esconder na bandeja', tray_showhide: 'Mostrar / esconder', tray_expand: 'Expandir painel', tray_refresh: 'Atualizar agora', tray_settings: 'Configurações…', tray_quit: 'Sair', tray_loading: 'carregando…', set_title: 'Configurações', set_language: 'Idioma', set_lang_auto: 'Automático (sistema)', set_start: 'Iniciar com o sistema', set_close: 'Fechar' },
    fr: { five_hour: '5 heures', week: 'semaine', resets_in: 'réinit. dans', resetting: 'réinitialisation…', updated: 'mis à jour', connecting: 'connexion…', offline: 'hors ligne · dernière donnée', updating: 'mise à jour…', cc_today: "Claude Code · aujourd'hui", input: 'entrée', output: 'sortie', cache_read: 'cache · lecture', cache_write: 'cache · écriture', equiv_cost: 'coût équivalent', cost_note: 'Claude Code (CLI) uniquement · ~valeur API, déjà incluse dans votre forfait Max', t_detailed: 'vue détaillée', t_simple: 'vue simple', t_expand: 'agrandir', t_refresh: 'actualiser', t_minimize: 'réduire', t_hide: 'masquer dans la barre', tray_showhide: 'Afficher / masquer', tray_expand: 'Agrandir le panneau', tray_refresh: 'Actualiser', tray_settings: 'Paramètres…', tray_quit: 'Quitter', tray_loading: 'chargement…', set_title: 'Paramètres', set_language: 'Langue', set_lang_auto: 'Auto (système)', set_start: 'Démarrer avec le système', set_close: 'Fermer' },
    de: { five_hour: '5 Stunden', week: 'Woche', resets_in: 'Reset in', resetting: 'wird zurückgesetzt…', updated: 'aktualisiert', connecting: 'verbinde…', offline: 'offline · letzte Daten', updating: 'aktualisiere…', cc_today: 'Claude Code · heute', input: 'Eingabe', output: 'Ausgabe', cache_read: 'Cache · Lesen', cache_write: 'Cache · Schreiben', equiv_cost: 'äquivalente Kosten', cost_note: 'nur Claude Code (CLI) · ~API-Wert, bereits in Ihrem Max-Plan enthalten', t_detailed: 'Detailansicht', t_simple: 'einfache Ansicht', t_expand: 'erweitern', t_refresh: 'jetzt aktualisieren', t_minimize: 'minimieren', t_hide: 'in Taskleiste ausblenden', tray_showhide: 'Anzeigen / ausblenden', tray_expand: 'Panel erweitern', tray_refresh: 'Jetzt aktualisieren', tray_settings: 'Einstellungen…', tray_quit: 'Beenden', tray_loading: 'lädt…', set_title: 'Einstellungen', set_language: 'Sprache', set_lang_auto: 'Automatisch (System)', set_start: 'Mit System starten', set_close: 'Schließen' },
    it: { five_hour: '5 ore', week: 'settimana', resets_in: 'reset tra', resetting: 'reset in corso…', updated: 'aggiornato', connecting: 'connessione…', offline: 'offline · ultimo dato', updating: 'aggiornamento…', cc_today: 'Claude Code · oggi', input: 'input', output: 'output', cache_read: 'cache · lettura', cache_write: 'cache · scrittura', equiv_cost: 'costo equivalente', cost_note: 'solo Claude Code (CLI) · ~valore API, già incluso nel tuo piano Max', t_detailed: 'vista dettagliata', t_simple: 'vista semplice', t_expand: 'espandi', t_refresh: 'aggiorna ora', t_minimize: 'riduci', t_hide: 'nascondi nella barra', tray_showhide: 'Mostra / nascondi', tray_expand: 'Espandi pannello', tray_refresh: 'Aggiorna ora', tray_settings: 'Impostazioni…', tray_quit: 'Esci', tray_loading: 'caricamento…', set_title: 'Impostazioni', set_language: 'Lingua', set_lang_auto: 'Automatico (sistema)', set_start: 'Avvia col sistema', set_close: 'Chiudi' },
    nl: { five_hour: '5 uur', week: 'week', resets_in: 'reset over', resetting: 'resetten…', updated: 'bijgewerkt', connecting: 'verbinden…', offline: 'offline · vorige data', updating: 'bijwerken…', cc_today: 'Claude Code · vandaag', input: 'invoer', output: 'uitvoer', cache_read: 'cache · lezen', cache_write: 'cache · schrijven', equiv_cost: 'equivalente kosten', cost_note: 'alleen Claude Code (CLI) · ~API-waarde, al inbegrepen in je Max-abonnement', t_detailed: 'gedetailleerde weergave', t_simple: 'eenvoudige weergave', t_expand: 'uitklappen', t_refresh: 'nu verversen', t_minimize: 'minimaliseren', t_hide: 'verbergen in systeemvak', tray_showhide: 'Tonen / verbergen', tray_expand: 'Paneel uitklappen', tray_refresh: 'Nu verversen', tray_settings: 'Instellingen…', tray_quit: 'Afsluiten', tray_loading: 'laden…', set_title: 'Instellingen', set_language: 'Taal', set_lang_auto: 'Automatisch (systeem)', set_start: 'Starten met systeem', set_close: 'Sluiten' },
    pl: { five_hour: '5 godzin', week: 'tydzień', resets_in: 'reset za', resetting: 'resetowanie…', updated: 'zaktualizowano', connecting: 'łączenie…', offline: 'offline · ostatnie dane', updating: 'aktualizacja…', cc_today: 'Claude Code · dziś', input: 'wejście', output: 'wyjście', cache_read: 'cache · odczyt', cache_write: 'cache · zapis', equiv_cost: 'koszt równoważny', cost_note: 'tylko Claude Code (CLI) · ~wartość API, już wliczona w plan Max', t_detailed: 'widok szczegółowy', t_simple: 'widok prosty', t_expand: 'rozwiń', t_refresh: 'odśwież teraz', t_minimize: 'minimalizuj', t_hide: 'ukryj w zasobniku', tray_showhide: 'Pokaż / ukryj', tray_expand: 'Rozwiń panel', tray_refresh: 'Odśwież teraz', tray_settings: 'Ustawienia…', tray_quit: 'Zakończ', tray_loading: 'ładowanie…', set_title: 'Ustawienia', set_language: 'Język', set_lang_auto: 'Automatycznie (system)', set_start: 'Uruchom z systemem', set_close: 'Zamknij' },
    ru: { five_hour: '5 часов', week: 'неделя', resets_in: 'сброс через', resetting: 'сброс…', updated: 'обновлено', connecting: 'подключение…', offline: 'нет сети · прошлые данные', updating: 'обновление…', cc_today: 'Claude Code · сегодня', input: 'ввод', output: 'вывод', cache_read: 'кэш · чтение', cache_write: 'кэш · запись', equiv_cost: 'эквивалентная стоимость', cost_note: 'только Claude Code (CLI) · ~цена API, уже включено в ваш план Max', t_detailed: 'подробный вид', t_simple: 'простой вид', t_expand: 'развернуть', t_refresh: 'обновить сейчас', t_minimize: 'свернуть', t_hide: 'скрыть в трей', tray_showhide: 'Показать / скрыть', tray_expand: 'Развернуть панель', tray_refresh: 'Обновить сейчас', tray_settings: 'Настройки…', tray_quit: 'Выход', tray_loading: 'загрузка…', set_title: 'Настройки', set_language: 'Язык', set_lang_auto: 'Авто (система)', set_start: 'Запускать с системой', set_close: 'Закрыть' },
    uk: { five_hour: '5 годин', week: 'тиждень', resets_in: 'скидання через', resetting: 'скидання…', updated: 'оновлено', connecting: 'підключення…', offline: 'немає мережі · попередні дані', updating: 'оновлення…', cc_today: 'Claude Code · сьогодні', input: 'ввід', output: 'вивід', cache_read: 'кеш · читання', cache_write: 'кеш · запис', equiv_cost: 'еквівалентна вартість', cost_note: 'лише Claude Code (CLI) · ~ціна API, вже включено у ваш план Max', t_detailed: 'детальний вигляд', t_simple: 'простий вигляд', t_expand: 'розгорнути', t_refresh: 'оновити зараз', t_minimize: 'згорнути', t_hide: 'сховати в трей', tray_showhide: 'Показати / сховати', tray_expand: 'Розгорнути панель', tray_refresh: 'Оновити зараз', tray_settings: 'Налаштування…', tray_quit: 'Вийти', tray_loading: 'завантаження…', set_title: 'Налаштування', set_language: 'Мова', set_lang_auto: 'Авто (система)', set_start: 'Запускати з системою', set_close: 'Закрити' },
    cs: { five_hour: '5 hodin', week: 'týden', resets_in: 'reset za', resetting: 'resetování…', updated: 'aktualizováno', connecting: 'připojování…', offline: 'offline · poslední data', updating: 'aktualizace…', cc_today: 'Claude Code · dnes', input: 'vstup', output: 'výstup', cache_read: 'cache · čtení', cache_write: 'cache · zápis', equiv_cost: 'ekvivalentní cena', cost_note: 'jen Claude Code (CLI) · ~cena API, již zahrnuto v plánu Max', t_detailed: 'podrobné zobrazení', t_simple: 'jednoduché zobrazení', t_expand: 'rozbalit', t_refresh: 'obnovit', t_minimize: 'minimalizovat', t_hide: 'skrýt do lišty', tray_showhide: 'Zobrazit / skrýt', tray_expand: 'Rozbalit panel', tray_refresh: 'Obnovit', tray_settings: 'Nastavení…', tray_quit: 'Ukončit', tray_loading: 'načítání…', set_title: 'Nastavení', set_language: 'Jazyk', set_lang_auto: 'Automaticky (systém)', set_start: 'Spustit se systémem', set_close: 'Zavřít' },
    sk: { five_hour: '5 hodín', week: 'týždeň', resets_in: 'reset o', resetting: 'resetovanie…', updated: 'aktualizované', connecting: 'pripájanie…', offline: 'offline · posledné dáta', updating: 'aktualizácia…', cc_today: 'Claude Code · dnes', input: 'vstup', output: 'výstup', cache_read: 'cache · čítanie', cache_write: 'cache · zápis', equiv_cost: 'ekvivalentná cena', cost_note: 'len Claude Code (CLI) · ~cena API, už zahrnuté v pláne Max', t_detailed: 'podrobné zobrazenie', t_simple: 'jednoduché zobrazenie', t_expand: 'rozbaliť', t_refresh: 'obnoviť', t_minimize: 'minimalizovať', t_hide: 'skryť do lišty', tray_showhide: 'Zobraziť / skryť', tray_expand: 'Rozbaliť panel', tray_refresh: 'Obnoviť', tray_settings: 'Nastavenia…', tray_quit: 'Ukončiť', tray_loading: 'načítava…', set_title: 'Nastavenia', set_language: 'Jazyk', set_lang_auto: 'Automaticky (systém)', set_start: 'Spustiť so systémom', set_close: 'Zavrieť' },
    ro: { five_hour: '5 ore', week: 'săptămână', resets_in: 'resetare în', resetting: 'resetare…', updated: 'actualizat', connecting: 'conectare…', offline: 'offline · ultimele date', updating: 'actualizare…', cc_today: 'Claude Code · azi', input: 'intrare', output: 'ieșire', cache_read: 'cache · citire', cache_write: 'cache · scriere', equiv_cost: 'cost echivalent', cost_note: 'doar Claude Code (CLI) · ~valoare API, deja inclus în planul Max', t_detailed: 'vizualizare detaliată', t_simple: 'vizualizare simplă', t_expand: 'extinde', t_refresh: 'reîmprospătează', t_minimize: 'minimizează', t_hide: 'ascunde în bară', tray_showhide: 'Arată / ascunde', tray_expand: 'Extinde panoul', tray_refresh: 'Reîmprospătează', tray_settings: 'Setări…', tray_quit: 'Ieșire', tray_loading: 'se încarcă…', set_title: 'Setări', set_language: 'Limbă', set_lang_auto: 'Automat (sistem)', set_start: 'Pornește cu sistemul', set_close: 'Închide' },
    hu: { five_hour: '5 óra', week: 'hét', resets_in: 'visszaáll', resetting: 'visszaállítás…', updated: 'frissítve', connecting: 'csatlakozás…', offline: 'offline · korábbi adat', updating: 'frissítés…', cc_today: 'Claude Code · ma', input: 'bemenet', output: 'kimenet', cache_read: 'gyorsítótár · olvasás', cache_write: 'gyorsítótár · írás', equiv_cost: 'egyenértékű költség', cost_note: 'csak Claude Code (CLI) · ~API-érték, már benne van a Max csomagban', t_detailed: 'részletes nézet', t_simple: 'egyszerű nézet', t_expand: 'kibontás', t_refresh: 'frissítés', t_minimize: 'kis méret', t_hide: 'elrejtés a tálcára', tray_showhide: 'Megjelenít / elrejt', tray_expand: 'Panel kibontása', tray_refresh: 'Frissítés most', tray_settings: 'Beállítások…', tray_quit: 'Kilépés', tray_loading: 'betöltés…', set_title: 'Beállítások', set_language: 'Nyelv', set_lang_auto: 'Automatikus (rendszer)', set_start: 'Indítás a rendszerrel', set_close: 'Bezárás' },
    el: { five_hour: '5 ώρες', week: 'εβδομάδα', resets_in: 'επαναφορά σε', resetting: 'επαναφορά…', updated: 'ενημερώθηκε', connecting: 'σύνδεση…', offline: 'εκτός σύνδεσης · προηγ. δεδομένα', updating: 'ενημέρωση…', cc_today: 'Claude Code · σήμερα', input: 'είσοδος', output: 'έξοδος', cache_read: 'cache · ανάγνωση', cache_write: 'cache · εγγραφή', equiv_cost: 'ισοδύναμο κόστος', cost_note: 'μόνο Claude Code (CLI) · ~τιμή API, ήδη στο πλάνο Max σας', t_detailed: 'αναλυτική προβολή', t_simple: 'απλή προβολή', t_expand: 'ανάπτυξη', t_refresh: 'ανανέωση', t_minimize: 'ελαχιστοποίηση', t_hide: 'απόκρυψη στη γραμμή', tray_showhide: 'Εμφάνιση / απόκρυψη', tray_expand: 'Ανάπτυξη πίνακα', tray_refresh: 'Ανανέωση τώρα', tray_settings: 'Ρυθμίσεις…', tray_quit: 'Έξοδος', tray_loading: 'φόρτωση…', set_title: 'Ρυθμίσεις', set_language: 'Γλώσσα', set_lang_auto: 'Αυτόματο (σύστημα)', set_start: 'Εκκίνηση με το σύστημα', set_close: 'Κλείσιμο' },
    sv: { five_hour: '5 timmar', week: 'vecka', resets_in: 'återställs om', resetting: 'återställer…', updated: 'uppdaterad', connecting: 'ansluter…', offline: 'offline · senaste data', updating: 'uppdaterar…', cc_today: 'Claude Code · idag', input: 'indata', output: 'utdata', cache_read: 'cache · läsning', cache_write: 'cache · skrivning', equiv_cost: 'motsvarande kostnad', cost_note: 'endast Claude Code (CLI) · ~API-värde, ingår redan i din Max-plan', t_detailed: 'detaljerad vy', t_simple: 'enkel vy', t_expand: 'expandera', t_refresh: 'uppdatera nu', t_minimize: 'minimera', t_hide: 'dölj i facket', tray_showhide: 'Visa / dölj', tray_expand: 'Expandera panel', tray_refresh: 'Uppdatera nu', tray_settings: 'Inställningar…', tray_quit: 'Avsluta', tray_loading: 'laddar…', set_title: 'Inställningar', set_language: 'Språk', set_lang_auto: 'Auto (system)', set_start: 'Starta med systemet', set_close: 'Stäng' },
    da: { five_hour: '5 timer', week: 'uge', resets_in: 'nulstilles om', resetting: 'nulstiller…', updated: 'opdateret', connecting: 'forbinder…', offline: 'offline · seneste data', updating: 'opdaterer…', cc_today: 'Claude Code · i dag', input: 'input', output: 'output', cache_read: 'cache · læsning', cache_write: 'cache · skrivning', equiv_cost: 'tilsvarende pris', cost_note: 'kun Claude Code (CLI) · ~API-værdi, allerede inkluderet i din Max-plan', t_detailed: 'detaljeret visning', t_simple: 'enkel visning', t_expand: 'udvid', t_refresh: 'opdater nu', t_minimize: 'minimer', t_hide: 'skjul i bakken', tray_showhide: 'Vis / skjul', tray_expand: 'Udvid panel', tray_refresh: 'Opdater nu', tray_settings: 'Indstillinger…', tray_quit: 'Afslut', tray_loading: 'indlæser…', set_title: 'Indstillinger', set_language: 'Sprog', set_lang_auto: 'Auto (system)', set_start: 'Start med systemet', set_close: 'Luk' },
    fi: { five_hour: '5 tuntia', week: 'viikko', resets_in: 'nollautuu', resetting: 'nollataan…', updated: 'päivitetty', connecting: 'yhdistetään…', offline: 'offline · edelliset tiedot', updating: 'päivitetään…', cc_today: 'Claude Code · tänään', input: 'syöte', output: 'tuloste', cache_read: 'välimuisti · luku', cache_write: 'välimuisti · kirjoitus', equiv_cost: 'vastaava hinta', cost_note: 'vain Claude Code (CLI) · ~API-arvo, jo mukana Max-tilauksessasi', t_detailed: 'yksityiskohtainen näkymä', t_simple: 'yksinkertainen näkymä', t_expand: 'laajenna', t_refresh: 'päivitä nyt', t_minimize: 'pienennä', t_hide: 'piilota ilmaisinalueelle', tray_showhide: 'Näytä / piilota', tray_expand: 'Laajenna paneeli', tray_refresh: 'Päivitä nyt', tray_settings: 'Asetukset…', tray_quit: 'Lopeta', tray_loading: 'ladataan…', set_title: 'Asetukset', set_language: 'Kieli', set_lang_auto: 'Auto (järjestelmä)', set_start: 'Käynnistä järjestelmän kanssa', set_close: 'Sulje' },
    nb: { five_hour: '5 timer', week: 'uke', resets_in: 'nullstilles om', resetting: 'nullstiller…', updated: 'oppdatert', connecting: 'kobler til…', offline: 'frakoblet · siste data', updating: 'oppdaterer…', cc_today: 'Claude Code · i dag', input: 'inndata', output: 'utdata', cache_read: 'cache · lesing', cache_write: 'cache · skriving', equiv_cost: 'tilsvarende kostnad', cost_note: 'kun Claude Code (CLI) · ~API-verdi, allerede inkludert i Max-planen din', t_detailed: 'detaljert visning', t_simple: 'enkel visning', t_expand: 'utvid', t_refresh: 'oppdater nå', t_minimize: 'minimer', t_hide: 'skjul i systemkurv', tray_showhide: 'Vis / skjul', tray_expand: 'Utvid panel', tray_refresh: 'Oppdater nå', tray_settings: 'Innstillinger…', tray_quit: 'Avslutt', tray_loading: 'laster…', set_title: 'Innstillinger', set_language: 'Språk', set_lang_auto: 'Auto (system)', set_start: 'Start med systemet', set_close: 'Lukk' },
    tr: { five_hour: '5 saat', week: 'hafta', resets_in: 'sıfırlanma', resetting: 'sıfırlanıyor…', updated: 'güncellendi', connecting: 'bağlanıyor…', offline: 'çevrimdışı · önceki veri', updating: 'güncelleniyor…', cc_today: 'Claude Code · bugün', input: 'giriş', output: 'çıkış', cache_read: 'önbellek · okuma', cache_write: 'önbellek · yazma', equiv_cost: 'eşdeğer maliyet', cost_note: 'yalnızca Claude Code (CLI) · ~API değeri, Max planınıza zaten dahil', t_detailed: 'ayrıntılı görünüm', t_simple: 'basit görünüm', t_expand: 'genişlet', t_refresh: 'şimdi yenile', t_minimize: 'küçült', t_hide: 'tepsiye gizle', tray_showhide: 'Göster / gizle', tray_expand: 'Paneli genişlet', tray_refresh: 'Şimdi yenile', tray_settings: 'Ayarlar…', tray_quit: 'Çıkış', tray_loading: 'yükleniyor…', set_title: 'Ayarlar', set_language: 'Dil', set_lang_auto: 'Otomatik (sistem)', set_start: 'Sistemle başlat', set_close: 'Kapat' },
    ca: { five_hour: '5 hores', week: 'setmana', resets_in: 'es reinicia en', resetting: 'reiniciant…', updated: 'actualitzat', connecting: 'connectant…', offline: 'sense connexió · darreres dades', updating: 'actualitzant…', cc_today: 'Claude Code · avui', input: 'entrada', output: 'sortida', cache_read: 'cau · lectura', cache_write: 'cau · escriptura', equiv_cost: 'cost equivalent', cost_note: 'només Claude Code (CLI) · ~valor API, ja inclòs al teu pla Max', t_detailed: 'vista detallada', t_simple: 'vista simple', t_expand: 'expandeix', t_refresh: 'actualitza ara', t_minimize: 'minimitza', t_hide: 'amaga a la safata', tray_showhide: 'Mostra / amaga', tray_expand: 'Expandeix el panell', tray_refresh: 'Actualitza ara', tray_settings: 'Configuració…', tray_quit: 'Surt', tray_loading: 'carregant…', set_title: 'Configuració', set_language: 'Idioma', set_lang_auto: 'Automàtic (sistema)', set_start: 'Inicia amb el sistema', set_close: 'Tanca' },
    bg: { five_hour: '5 часа', week: 'седмица', resets_in: 'нулиране след', resetting: 'нулиране…', updated: 'обновено', connecting: 'свързване…', offline: 'офлайн · последни данни', updating: 'обновяване…', cc_today: 'Claude Code · днес', input: 'вход', output: 'изход', cache_read: 'кеш · четене', cache_write: 'кеш · запис', equiv_cost: 'еквивалентна цена', cost_note: 'само Claude Code (CLI) · ~стойност на API, вече включено в плана Max', t_detailed: 'подробен изглед', t_simple: 'опростен изглед', t_expand: 'разгъни', t_refresh: 'обнови сега', t_minimize: 'минимизирай', t_hide: 'скрий в тавата', tray_showhide: 'Покажи / скрий', tray_expand: 'Разгъни панела', tray_refresh: 'Обнови сега', tray_settings: 'Настройки…', tray_quit: 'Изход', tray_loading: 'зареждане…', set_title: 'Настройки', set_language: 'Език', set_lang_auto: 'Авто (система)', set_start: 'Стартирай със системата', set_close: 'Затвори' },
    hr: { five_hour: '5 sati', week: 'tjedan', resets_in: 'reset za', resetting: 'resetiranje…', updated: 'ažurirano', connecting: 'povezivanje…', offline: 'offline · zadnji podaci', updating: 'ažuriranje…', cc_today: 'Claude Code · danas', input: 'ulaz', output: 'izlaz', cache_read: 'cache · čitanje', cache_write: 'cache · pisanje', equiv_cost: 'ekvivalentni trošak', cost_note: 'samo Claude Code (CLI) · ~vrijednost API-ja, već uključeno u Max plan', t_detailed: 'detaljni prikaz', t_simple: 'jednostavni prikaz', t_expand: 'proširi', t_refresh: 'osvježi', t_minimize: 'smanji', t_hide: 'sakrij u traku', tray_showhide: 'Prikaži / sakrij', tray_expand: 'Proširi ploču', tray_refresh: 'Osvježi sada', tray_settings: 'Postavke…', tray_quit: 'Izlaz', tray_loading: 'učitavanje…', set_title: 'Postavke', set_language: 'Jezik', set_lang_auto: 'Automatski (sustav)', set_start: 'Pokreni sa sustavom', set_close: 'Zatvori' },
    sr: { five_hour: '5 сати', week: 'недеља', resets_in: 'ресет за', resetting: 'ресетовање…', updated: 'ажурирано', connecting: 'повезивање…', offline: 'офлајн · последњи подаци', updating: 'ажурирање…', cc_today: 'Claude Code · данас', input: 'улаз', output: 'излаз', cache_read: 'кеш · читање', cache_write: 'кеш · упис', equiv_cost: 'еквивалентни трошак', cost_note: 'само Claude Code (CLI) · ~вредност API-ја, већ укључено у Max план', t_detailed: 'детаљни приказ', t_simple: 'једноставан приказ', t_expand: 'прошири', t_refresh: 'освежи', t_minimize: 'умањи', t_hide: 'сакриј у траку', tray_showhide: 'Прикажи / сакриј', tray_expand: 'Прошири панел', tray_refresh: 'Освежи сада', tray_settings: 'Подешавања…', tray_quit: 'Излаз', tray_loading: 'учитавање…', set_title: 'Подешавања', set_language: 'Језик', set_lang_auto: 'Аутоматски (систем)', set_start: 'Покрени са системом', set_close: 'Затвори' },
    lt: { five_hour: '5 valandos', week: 'savaitė', resets_in: 'atstatoma po', resetting: 'atstatoma…', updated: 'atnaujinta', connecting: 'jungiamasi…', offline: 'neprisijungus · paskutiniai duomenys', updating: 'atnaujinama…', cc_today: 'Claude Code · šiandien', input: 'įvestis', output: 'išvestis', cache_read: 'talpykla · skaitymas', cache_write: 'talpykla · rašymas', equiv_cost: 'lygiavertė kaina', cost_note: 'tik Claude Code (CLI) · ~API vertė, jau įtraukta į Max planą', t_detailed: 'išsamus rodinys', t_simple: 'paprastas rodinys', t_expand: 'išskleisti', t_refresh: 'atnaujinti', t_minimize: 'sumažinti', t_hide: 'slėpti į dėklą', tray_showhide: 'Rodyti / slėpti', tray_expand: 'Išskleisti skydelį', tray_refresh: 'Atnaujinti dabar', tray_settings: 'Nustatymai…', tray_quit: 'Išeiti', tray_loading: 'įkeliama…', set_title: 'Nustatymai', set_language: 'Kalba', set_lang_auto: 'Automatinis (sistema)', set_start: 'Paleisti su sistema', set_close: 'Uždaryti' },
    ja: { five_hour: '5時間', week: '週', resets_in: 'リセットまで', resetting: 'リセット中…', updated: '更新', connecting: '接続中…', offline: 'オフライン · 前回のデータ', updating: '更新中…', cc_today: 'Claude Code · 今日', input: '入力', output: '出力', cache_read: 'キャッシュ · 読取', cache_write: 'キャッシュ · 書込', equiv_cost: '相当コスト', cost_note: 'Claude Code (CLI) のみ · ~API換算、Maxプランに含まれます', t_detailed: '詳細表示', t_simple: 'シンプル表示', t_expand: '展開', t_refresh: '今すぐ更新', t_minimize: '最小化', t_hide: 'トレイに隠す', tray_showhide: '表示 / 非表示', tray_expand: 'パネルを展開', tray_refresh: '今すぐ更新', tray_settings: '設定…', tray_quit: '終了', tray_loading: '読込中…', set_title: '設定', set_language: '言語', set_lang_auto: '自動（システム）', set_start: 'システム起動時に開始', set_close: '閉じる' },
    ko: { five_hour: '5시간', week: '주간', resets_in: '초기화까지', resetting: '초기화 중…', updated: '업데이트됨', connecting: '연결 중…', offline: '오프라인 · 이전 데이터', updating: '업데이트 중…', cc_today: 'Claude Code · 오늘', input: '입력', output: '출력', cache_read: '캐시 · 읽기', cache_write: '캐시 · 쓰기', equiv_cost: '환산 비용', cost_note: 'Claude Code (CLI) 전용 · ~API 환산, Max 요금제에 이미 포함', t_detailed: '상세 보기', t_simple: '간단 보기', t_expand: '펼치기', t_refresh: '지금 새로고침', t_minimize: '최소화', t_hide: '트레이로 숨기기', tray_showhide: '표시 / 숨기기', tray_expand: '패널 펼치기', tray_refresh: '지금 새로고침', tray_settings: '설정…', tray_quit: '종료', tray_loading: '로딩 중…', set_title: '설정', set_language: '언어', set_lang_auto: '자동(시스템)', set_start: '시스템과 함께 시작', set_close: '닫기' },
    zh: { five_hour: '5 小时', week: '本周', resets_in: '重置于', resetting: '重置中…', updated: '已更新', connecting: '连接中…', offline: '离线 · 上次数据', updating: '更新中…', cc_today: 'Claude Code · 今天', input: '输入', output: '输出', cache_read: '缓存 · 读取', cache_write: '缓存 · 写入', equiv_cost: '等效费用', cost_note: '仅 Claude Code (CLI) · ~API 价值，已包含在你的 Max 套餐中', t_detailed: '详细视图', t_simple: '简洁视图', t_expand: '展开', t_refresh: '立即刷新', t_minimize: '最小化', t_hide: '隐藏到托盘', tray_showhide: '显示 / 隐藏', tray_expand: '展开面板', tray_refresh: '立即刷新', tray_settings: '设置…', tray_quit: '退出', tray_loading: '加载中…', set_title: '设置', set_language: '语言', set_lang_auto: '自动（系统）', set_start: '随系统启动', set_close: '关闭' },
    vi: { five_hour: '5 giờ', week: 'tuần', resets_in: 'đặt lại sau', resetting: 'đang đặt lại…', updated: 'đã cập nhật', connecting: 'đang kết nối…', offline: 'ngoại tuyến · dữ liệu trước', updating: 'đang cập nhật…', cc_today: 'Claude Code · hôm nay', input: 'đầu vào', output: 'đầu ra', cache_read: 'bộ nhớ đệm · đọc', cache_write: 'bộ nhớ đệm · ghi', equiv_cost: 'chi phí tương đương', cost_note: 'chỉ Claude Code (CLI) · ~giá trị API, đã bao gồm trong gói Max', t_detailed: 'xem chi tiết', t_simple: 'xem đơn giản', t_expand: 'mở rộng', t_refresh: 'làm mới ngay', t_minimize: 'thu nhỏ', t_hide: 'ẩn vào khay', tray_showhide: 'Hiện / ẩn', tray_expand: 'Mở rộng bảng', tray_refresh: 'Làm mới ngay', tray_settings: 'Cài đặt…', tray_quit: 'Thoát', tray_loading: 'đang tải…', set_title: 'Cài đặt', set_language: 'Ngôn ngữ', set_lang_auto: 'Tự động (hệ thống)', set_start: 'Khởi động cùng hệ thống', set_close: 'Đóng' },
    th: { five_hour: '5 ชั่วโมง', week: 'สัปดาห์', resets_in: 'รีเซ็ตในอีก', resetting: 'กำลังรีเซ็ต…', updated: 'อัปเดตแล้ว', connecting: 'กำลังเชื่อมต่อ…', offline: 'ออฟไลน์ · ข้อมูลก่อนหน้า', updating: 'กำลังอัปเดต…', cc_today: 'Claude Code · วันนี้', input: 'อินพุต', output: 'เอาต์พุต', cache_read: 'แคช · อ่าน', cache_write: 'แคช · เขียน', equiv_cost: 'ค่าใช้จ่ายเทียบเท่า', cost_note: 'เฉพาะ Claude Code (CLI) · ~มูลค่า API, รวมอยู่ในแผน Max แล้ว', t_detailed: 'มุมมองละเอียด', t_simple: 'มุมมองอย่างง่าย', t_expand: 'ขยาย', t_refresh: 'รีเฟรชตอนนี้', t_minimize: 'ย่อ', t_hide: 'ซ่อนในถาด', tray_showhide: 'แสดง / ซ่อน', tray_expand: 'ขยายแผง', tray_refresh: 'รีเฟรชตอนนี้', tray_settings: 'การตั้งค่า…', tray_quit: 'ออก', tray_loading: 'กำลังโหลด…', set_title: 'การตั้งค่า', set_language: 'ภาษา', set_lang_auto: 'อัตโนมัติ (ระบบ)', set_start: 'เริ่มพร้อมระบบ', set_close: 'ปิด' },
    id: { five_hour: '5 jam', week: 'minggu', resets_in: 'reset dalam', resetting: 'mereset…', updated: 'diperbarui', connecting: 'menghubungkan…', offline: 'luring · data sebelumnya', updating: 'memperbarui…', cc_today: 'Claude Code · hari ini', input: 'masukan', output: 'keluaran', cache_read: 'cache · baca', cache_write: 'cache · tulis', equiv_cost: 'biaya setara', cost_note: 'hanya Claude Code (CLI) · ~nilai API, sudah termasuk dalam paket Max', t_detailed: 'tampilan rinci', t_simple: 'tampilan sederhana', t_expand: 'perluas', t_refresh: 'segarkan', t_minimize: 'perkecil', t_hide: 'sembunyikan ke baki', tray_showhide: 'Tampilkan / sembunyikan', tray_expand: 'Perluas panel', tray_refresh: 'Segarkan sekarang', tray_settings: 'Pengaturan…', tray_quit: 'Keluar', tray_loading: 'memuat…', set_title: 'Pengaturan', set_language: 'Bahasa', set_lang_auto: 'Otomatis (sistem)', set_start: 'Jalankan bersama sistem', set_close: 'Tutup' },
    ms: { five_hour: '5 jam', week: 'minggu', resets_in: 'set semula dalam', resetting: 'menetapkan semula…', updated: 'dikemas kini', connecting: 'menyambung…', offline: 'luar talian · data terdahulu', updating: 'mengemas kini…', cc_today: 'Claude Code · hari ini', input: 'input', output: 'output', cache_read: 'cache · baca', cache_write: 'cache · tulis', equiv_cost: 'kos setara', cost_note: 'hanya Claude Code (CLI) · ~nilai API, sudah termasuk dalam pelan Max', t_detailed: 'paparan terperinci', t_simple: 'paparan ringkas', t_expand: 'kembangkan', t_refresh: 'muat semula', t_minimize: 'minimumkan', t_hide: 'sembunyi ke dulang', tray_showhide: 'Tunjuk / sembunyi', tray_expand: 'Kembangkan panel', tray_refresh: 'Muat semula', tray_settings: 'Tetapan…', tray_quit: 'Keluar', tray_loading: 'memuatkan…', set_title: 'Tetapan', set_language: 'Bahasa', set_lang_auto: 'Auto (sistem)', set_start: 'Mula dengan sistem', set_close: 'Tutup' },
    fil: { five_hour: '5 oras', week: 'linggo', resets_in: 'magre-reset sa', resetting: 'nirireset…', updated: 'na-update', connecting: 'kumukonekta…', offline: 'offline · huling datos', updating: 'ina-update…', cc_today: 'Claude Code · ngayon', input: 'input', output: 'output', cache_read: 'cache · basa', cache_write: 'cache · sulat', equiv_cost: 'katumbas na halaga', cost_note: 'Claude Code (CLI) lang · ~halaga ng API, kasama na sa iyong Max plan', t_detailed: 'detalyadong view', t_simple: 'simpleng view', t_expand: 'palawakin', t_refresh: 'i-refresh', t_minimize: 'i-minimize', t_hide: 'itago sa tray', tray_showhide: 'Ipakita / itago', tray_expand: 'Palawakin ang panel', tray_refresh: 'I-refresh ngayon', tray_settings: 'Mga setting…', tray_quit: 'Lumabas', tray_loading: 'naglo-load…', set_title: 'Mga setting', set_language: 'Wika', set_lang_auto: 'Auto (sistema)', set_start: 'Magsimula kasama ng sistema', set_close: 'Isara' },
    hi: { five_hour: '5 घंटे', week: 'सप्ताह', resets_in: 'रीसेट में', resetting: 'रीसेट हो रहा…', updated: 'अपडेट किया', connecting: 'कनेक्ट हो रहा…', offline: 'ऑफ़लाइन · पिछला डेटा', updating: 'अपडेट हो रहा…', cc_today: 'Claude Code · आज', input: 'इनपुट', output: 'आउटपुट', cache_read: 'कैश · पढ़ना', cache_write: 'कैश · लिखना', equiv_cost: 'समतुल्य लागत', cost_note: 'केवल Claude Code (CLI) · ~API मूल्य, आपके Max प्लान में शामिल', t_detailed: 'विस्तृत दृश्य', t_simple: 'सरल दृश्य', t_expand: 'विस्तार करें', t_refresh: 'अभी ताज़ा करें', t_minimize: 'छोटा करें', t_hide: 'ट्रे में छिपाएँ', tray_showhide: 'दिखाएँ / छिपाएँ', tray_expand: 'पैनल विस्तार करें', tray_refresh: 'अभी ताज़ा करें', tray_settings: 'सेटिंग्स…', tray_quit: 'बाहर निकलें', tray_loading: 'लोड हो रहा…', set_title: 'सेटिंग्स', set_language: 'भाषा', set_lang_auto: 'स्वतः (सिस्टम)', set_start: 'सिस्टम के साथ शुरू करें', set_close: 'बंद करें' },
    ar: { five_hour: '5 ساعات', week: 'الأسبوع', resets_in: 'إعادة الضبط خلال', resetting: 'جارٍ إعادة الضبط…', updated: 'محدَّث', connecting: 'جارٍ الاتصال…', offline: 'غير متصل · آخر بيانات', updating: 'جارٍ التحديث…', cc_today: 'Claude Code · اليوم', input: 'إدخال', output: 'إخراج', cache_read: 'ذاكرة مؤقتة · قراءة', cache_write: 'ذاكرة مؤقتة · كتابة', equiv_cost: 'التكلفة المكافئة', cost_note: 'Claude Code (CLI) فقط · ~قيمة API، مشمولة في خطة Max', t_detailed: 'عرض مفصّل', t_simple: 'عرض بسيط', t_expand: 'توسيع', t_refresh: 'تحديث الآن', t_minimize: 'تصغير', t_hide: 'إخفاء في الشريط', tray_showhide: 'إظهار / إخفاء', tray_expand: 'توسيع اللوحة', tray_refresh: 'تحديث الآن', tray_settings: 'الإعدادات…', tray_quit: 'خروج', tray_loading: 'جارٍ التحميل…', set_title: 'الإعدادات', set_language: 'اللغة', set_lang_auto: 'تلقائي (النظام)', set_start: 'البدء مع النظام', set_close: 'إغلاق' },
    he: { five_hour: '5 שעות', week: 'שבוע', resets_in: 'איפוס בעוד', resetting: 'מאפס…', updated: 'עודכן', connecting: 'מתחבר…', offline: 'לא מקוון · נתונים אחרונים', updating: 'מעדכן…', cc_today: 'Claude Code · היום', input: 'קלט', output: 'פלט', cache_read: 'מטמון · קריאה', cache_write: 'מטמון · כתיבה', equiv_cost: 'עלות שווה ערך', cost_note: 'רק Claude Code (CLI) · ~ערך API, כבר כלול בתוכנית Max', t_detailed: 'תצוגה מפורטת', t_simple: 'תצוגה פשוטה', t_expand: 'הרחב', t_refresh: 'רענן עכשיו', t_minimize: 'מזער', t_hide: 'הסתר למגש', tray_showhide: 'הצג / הסתר', tray_expand: 'הרחב לוח', tray_refresh: 'רענן עכשיו', tray_settings: 'הגדרות…', tray_quit: 'יציאה', tray_loading: 'טוען…', set_title: 'הגדרות', set_language: 'שפה', set_lang_auto: 'אוטומטי (מערכת)', set_start: 'הפעל עם המערכת', set_close: 'סגור' },
    fa: { five_hour: '۵ ساعت', week: 'هفته', resets_in: 'بازنشانی تا', resetting: 'در حال بازنشانی…', updated: 'به‌روزشده', connecting: 'در حال اتصال…', offline: 'آفلاین · داده قبلی', updating: 'در حال به‌روزرسانی…', cc_today: 'Claude Code · امروز', input: 'ورودی', output: 'خروجی', cache_read: 'کش · خواندن', cache_write: 'کش · نوشتن', equiv_cost: 'هزینه معادل', cost_note: 'فقط Claude Code (CLI) · ~ارزش API، در پلن Max شما گنجانده شده', t_detailed: 'نمای کامل', t_simple: 'نمای ساده', t_expand: 'گسترش', t_refresh: 'تازه‌سازی', t_minimize: 'کوچک کردن', t_hide: 'پنهان در سینی', tray_showhide: 'نمایش / پنهان', tray_expand: 'گسترش پنل', tray_refresh: 'تازه‌سازی اکنون', tray_settings: 'تنظیمات…', tray_quit: 'خروج', tray_loading: 'در حال بارگذاری…', set_title: 'تنظیمات', set_language: 'زبان', set_lang_auto: 'خودکار (سیستم)', set_start: 'اجرا با سیستم', set_close: 'بستن' },
  };

  // feedback strings (merged into DICT above)
  const FEEDBACK = {
    en: { set_feedback: 'Feedback', feedback_ph: 'Found a bug or have an idea?', feedback_send: 'Send', feedback_thanks: 'Thanks for the feedback!' },
    es: { set_feedback: 'Comentarios', feedback_ph: '¿Un error o una idea?', feedback_send: 'Enviar', feedback_thanks: '¡Gracias por tu comentario!' },
    pt: { set_feedback: 'Feedback', feedback_ph: 'Achou um bug ou tem uma ideia?', feedback_send: 'Enviar', feedback_thanks: 'Valeu pelo feedback!' },
    fr: { set_feedback: 'Retour', feedback_ph: 'Un bug ou une idée ?', feedback_send: 'Envoyer', feedback_thanks: 'Merci pour votre retour !' },
    de: { set_feedback: 'Feedback', feedback_ph: 'Fehler gefunden oder eine Idee?', feedback_send: 'Senden', feedback_thanks: 'Danke für dein Feedback!' },
    it: { set_feedback: 'Feedback', feedback_ph: "Un bug o un'idea?", feedback_send: 'Invia', feedback_thanks: 'Grazie per il feedback!' },
    nl: { set_feedback: 'Feedback', feedback_ph: 'Bug gevonden of een idee?', feedback_send: 'Verstuur', feedback_thanks: 'Bedankt voor je feedback!' },
    pl: { set_feedback: 'Opinia', feedback_ph: 'Błąd lub pomysł?', feedback_send: 'Wyślij', feedback_thanks: 'Dzięki za opinię!' },
    ru: { set_feedback: 'Отзыв', feedback_ph: 'Нашли баг или есть идея?', feedback_send: 'Отправить', feedback_thanks: 'Спасибо за отзыв!' },
    uk: { set_feedback: 'Відгук', feedback_ph: 'Знайшли баг чи маєте ідею?', feedback_send: 'Надіслати', feedback_thanks: 'Дякуємо за відгук!' },
    cs: { set_feedback: 'Zpětná vazba', feedback_ph: 'Chyba nebo nápad?', feedback_send: 'Odeslat', feedback_thanks: 'Díky za zpětnou vazbu!' },
    sk: { set_feedback: 'Spätná väzba', feedback_ph: 'Chyba alebo nápad?', feedback_send: 'Odoslať', feedback_thanks: 'Vďaka za spätnú väzbu!' },
    ro: { set_feedback: 'Feedback', feedback_ph: 'O eroare sau o idee?', feedback_send: 'Trimite', feedback_thanks: 'Mulțumim pentru feedback!' },
    hu: { set_feedback: 'Visszajelzés', feedback_ph: 'Hibát találtál vagy van ötleted?', feedback_send: 'Küldés', feedback_thanks: 'Köszönjük a visszajelzést!' },
    el: { set_feedback: 'Σχόλια', feedback_ph: 'Βρήκες σφάλμα ή έχεις ιδέα;', feedback_send: 'Αποστολή', feedback_thanks: 'Ευχαριστούμε για τα σχόλια!' },
    sv: { set_feedback: 'Feedback', feedback_ph: 'Hittade du en bugg eller har en idé?', feedback_send: 'Skicka', feedback_thanks: 'Tack för din feedback!' },
    da: { set_feedback: 'Feedback', feedback_ph: 'Fandt du en fejl eller har en idé?', feedback_send: 'Send', feedback_thanks: 'Tak for din feedback!' },
    fi: { set_feedback: 'Palaute', feedback_ph: 'Löysitkö bugin tai onko idea?', feedback_send: 'Lähetä', feedback_thanks: 'Kiitos palautteesta!' },
    nb: { set_feedback: 'Tilbakemelding', feedback_ph: 'Fant du en feil eller har en idé?', feedback_send: 'Send', feedback_thanks: 'Takk for tilbakemeldingen!' },
    tr: { set_feedback: 'Geri bildirim', feedback_ph: 'Hata mı buldun, fikrin mi var?', feedback_send: 'Gönder', feedback_thanks: 'Geri bildirim için teşekkürler!' },
    ca: { set_feedback: 'Comentaris', feedback_ph: 'Has trobat un error o tens una idea?', feedback_send: 'Envia', feedback_thanks: 'Gràcies pels comentaris!' },
    bg: { set_feedback: 'Обратна връзка', feedback_ph: 'Открихте грешка или имате идея?', feedback_send: 'Изпрати', feedback_thanks: 'Благодарим за обратната връзка!' },
    hr: { set_feedback: 'Povratne informacije', feedback_ph: 'Greška ili ideja?', feedback_send: 'Pošalji', feedback_thanks: 'Hvala na povratnim informacijama!' },
    sr: { set_feedback: 'Повратне информације', feedback_ph: 'Грешка или идеја?', feedback_send: 'Пошаљи', feedback_thanks: 'Хвала на повратним информацијама!' },
    lt: { set_feedback: 'Atsiliepimas', feedback_ph: 'Radote klaidą ar turite idėją?', feedback_send: 'Siųsti', feedback_thanks: 'Ačiū už atsiliepimą!' },
    ja: { set_feedback: 'フィードバック', feedback_ph: 'バグや要望は？', feedback_send: '送信', feedback_thanks: 'フィードバックありがとうございます！' },
    ko: { set_feedback: '피드백', feedback_ph: '버그나 아이디어가 있나요?', feedback_send: '보내기', feedback_thanks: '피드백 감사합니다!' },
    zh: { set_feedback: '反馈', feedback_ph: '发现问题或有想法？', feedback_send: '发送', feedback_thanks: '感谢你的反馈！' },
    vi: { set_feedback: 'Phản hồi', feedback_ph: 'Phát hiện lỗi hay có ý tưởng?', feedback_send: 'Gửi', feedback_thanks: 'Cảm ơn phản hồi của bạn!' },
    th: { set_feedback: 'ความคิดเห็น', feedback_ph: 'พบบั๊กหรือมีไอเดีย?', feedback_send: 'ส่ง', feedback_thanks: 'ขอบคุณสำหรับความคิดเห็น!' },
    id: { set_feedback: 'Masukan', feedback_ph: 'Menemukan bug atau punya ide?', feedback_send: 'Kirim', feedback_thanks: 'Terima kasih atas masukannya!' },
    ms: { set_feedback: 'Maklum balas', feedback_ph: 'Jumpa pepijat atau ada idea?', feedback_send: 'Hantar', feedback_thanks: 'Terima kasih atas maklum balas!' },
    fil: { set_feedback: 'Feedback', feedback_ph: 'May bug o ideya?', feedback_send: 'Ipadala', feedback_thanks: 'Salamat sa feedback!' },
    hi: { set_feedback: 'फ़ीडबैक', feedback_ph: 'बग मिला या कोई सुझाव है?', feedback_send: 'भेजें', feedback_thanks: 'फ़ीडबैक के लिए धन्यवाद!' },
    ar: { set_feedback: 'ملاحظات', feedback_ph: 'وجدت خطأً أو لديك فكرة؟', feedback_send: 'إرسال', feedback_thanks: 'شكرًا على ملاحظاتك!' },
    he: { set_feedback: 'משוב', feedback_ph: 'מצאת באג או שיש לך רעיון?', feedback_send: 'שלח', feedback_thanks: 'תודה על המשוב!' },
    fa: { set_feedback: 'بازخورد', feedback_ph: 'باگی پیدا کردید یا ایده‌ای دارید؟', feedback_send: 'ارسال', feedback_thanks: 'ممنون از بازخوردتان!' },
  };
  for (const k in FEEDBACK) if (DICT[k]) Object.assign(DICT[k], FEEDBACK[k]);

  // The form hands the message to the OS mail client; with no mailto handler
  // registered (common on Linux) that hand-off fails and nothing is sent. Saying
  // "thanks" there while wiping the textarea destroys what the user wrote — so
  // there's an honest failure line instead. en/pt; other locales fall back to en.
  const FEEDBACK_FAIL = {
    en: 'Couldn’t open your email app — nothing was sent. Your text is still here.',
    pt: 'Não consegui abrir seu app de e-mail — nada foi enviado. Seu texto continua aqui.',
  };
  for (const k in FEEDBACK_FAIL) if (DICT[k]) DICT[k].feedback_failed = FEEDBACK_FAIL[k];

  const DONATE = {
    en: 'Support my projects', es: 'Apoya mis proyectos', pt: 'Apoiar meus projetos',
    fr: 'Soutenir mes projets', de: 'Meine Projekte unterstützen', it: 'Sostieni i miei progetti',
    nl: 'Steun mijn projecten', pl: 'Wesprzyj moje projekty', ru: 'Поддержать мои проекты',
    uk: 'Підтримати мої проєкти', cs: 'Podpořit mé projekty', sk: 'Podporiť moje projekty',
    ro: 'Susține-mi proiectele', hu: 'Támogasd a projektjeimet', el: 'Στήριξε τα έργα μου',
    sv: 'Stöd mina projekt', da: 'Støt mine projekter', fi: 'Tue projektejani',
    nb: 'Støtt prosjektene mine', tr: 'Projelerime destek ol', ca: 'Dóna suport als meus projectes',
    bg: 'Подкрепи проектите ми', hr: 'Podrži moje projekte', sr: 'Подржи моје пројекте',
    lt: 'Paremkite mano projektus', ja: 'プロジェクトを支援', ko: '프로젝트 후원하기',
    zh: '支持我的项目', vi: 'Ủng hộ dự án của tôi', th: 'สนับสนุนโปรเจกต์ของฉัน',
    id: 'Dukung proyek saya', ms: 'Sokong projek saya', fil: 'Suportahan ang mga proyekto ko',
    hi: 'मेरे प्रोजेक्ट्स का समर्थन करें', ar: 'ادعم مشاريعي', he: 'תמכו בפרויקטים שלי',
    fa: 'از پروژه‌هایم حمایت کنید',
  };
  for (const k in DONATE) if (DICT[k]) DICT[k].set_donate = DONATE[k];

  // cost = equivalent API value (the "included in Max" note gives the context)
  const COST = {
    en: 'API value', es: 'valor en API', pt: 'valor em API', fr: 'valeur API',
    de: 'API-Wert', it: 'valore API', nl: 'API-waarde', pl: 'wartość w API',
    ru: 'цена в API', uk: 'ціна в API', cs: 'hodnota v API', sk: 'hodnota v API',
    ro: 'valoare API', hu: 'API-érték', el: 'αξία σε API', sv: 'API-värde',
    da: 'API-værdi', fi: 'API-arvo', nb: 'API-verdi', tr: 'API değeri',
    ca: 'valor en API', bg: 'стойност в API', hr: 'vrijednost u API-ju', sr: 'вредност у API-ју',
    lt: 'vertė per API', ja: 'API換算', ko: 'API 환산', zh: 'API 价值',
    vi: 'giá trị API', th: 'มูลค่าใน API', id: 'nilai di API', ms: 'nilai di API',
    fil: 'halaga sa API', hi: 'API मूल्य', ar: 'قيمة بالـ API', he: 'ערך ב-API',
    fa: 'ارزش در API',
  };
  for (const k in COST) if (DICT[k]) DICT[k].equiv_cost = COST[k];

  // Token went stale. Claude Code refreshes it (and only Claude Code does — the
  // widget never mints tokens), so the status is a short, actionable nudge rather
  // than an alarming "expired", with the one-step fix in the tooltip (expired_hint).
  const EXPIRED = {
    en: 'open Claude Code', es: 'abre Claude Code', pt: 'abra o Claude Code', fr: 'ouvrez Claude Code',
    de: 'Claude Code öffnen', it: 'apri Claude Code', nl: 'open Claude Code', pl: 'otwórz Claude Code',
    ru: 'откройте Claude Code', uk: 'відкрийте Claude Code', cs: 'otevřete Claude Code', sk: 'otvorte Claude Code',
    ro: 'deschide Claude Code', hu: 'nyisd meg a Claude Code-ot', el: 'άνοιξε το Claude Code', sv: 'öppna Claude Code',
    da: 'åbn Claude Code', fi: 'avaa Claude Code', nb: 'åpne Claude Code', tr: "Claude Code'u aç",
    ca: 'obre Claude Code', bg: 'отворете Claude Code', hr: 'otvori Claude Code', sr: 'отвори Claude Code',
    lt: 'atidarykite Claude Code', ja: 'Claude Code を開く', ko: 'Claude Code 열기', zh: '打开 Claude Code',
    vi: 'mở Claude Code', th: 'เปิด Claude Code', id: 'buka Claude Code', ms: 'buka Claude Code',
    fil: 'buksan ang Claude Code', hi: 'Claude Code खोलें', ar: 'افتح Claude Code', he: 'פתח את Claude Code',
    fa: 'Claude Code را باز کنید',
  };
  for (const k in EXPIRED) if (DICT[k]) DICT[k].expired = EXPIRED[k];

  const EXPIRED_HINT = {
    en: 'Only Claude Code refreshes this token — run any Claude Code command to update it.',
    es: 'Solo Claude Code renueva este token: ejecuta cualquier comando de Claude Code para actualizarlo.',
    pt: 'Só o Claude Code renova este token — rode qualquer comando do Claude Code para atualizá-lo.',
    fr: "Seul Claude Code renouvelle ce jeton — exécutez n'importe quelle commande Claude Code pour le mettre à jour.",
    de: 'Nur Claude Code erneuert dieses Token – führen Sie einen beliebigen Claude-Code-Befehl aus, um es zu aktualisieren.',
    it: 'Solo Claude Code rinnova questo token: esegui un comando qualsiasi di Claude Code per aggiornarlo.',
    nl: 'Alleen Claude Code vernieuwt dit token — voer een willekeurig Claude Code-commando uit om het bij te werken.',
    pl: 'Tylko Claude Code odświeża ten token — uruchom dowolną komendę Claude Code, aby go zaktualizować.',
    ru: 'Только Claude Code обновляет этот токен — выполните любую команду Claude Code, чтобы обновить его.',
    uk: 'Лише Claude Code оновлює цей токен — виконайте будь-яку команду Claude Code, щоб оновити його.',
    cs: 'Tento token obnovuje jen Claude Code — spusťte libovolný příkaz Claude Code pro jeho aktualizaci.',
    sk: 'Tento token obnovuje len Claude Code — spustite ľubovoľný príkaz Claude Code na jeho aktualizáciu.',
    ro: 'Doar Claude Code reînnoiește acest token — rulează orice comandă Claude Code pentru a-l actualiza.',
    hu: 'Ezt a tokent csak a Claude Code újítja meg — futtass bármilyen Claude Code parancsot a frissítéséhez.',
    el: 'Μόνο το Claude Code ανανεώνει αυτό το token — εκτέλεσε οποιαδήποτε εντολή Claude Code για να το ενημερώσεις.',
    sv: 'Endast Claude Code förnyar denna token — kör valfritt Claude Code-kommando för att uppdatera den.',
    da: 'Kun Claude Code fornyer dette token — kør en hvilken som helst Claude Code-kommando for at opdatere det.',
    fi: 'Vain Claude Code uusii tämän tokenin — suorita mikä tahansa Claude Code -komento päivittääksesi sen.',
    nb: 'Bare Claude Code fornyer dette tokenet — kjør en hvilken som helst Claude Code-kommando for å oppdatere det.',
    tr: 'Bu jetonu yalnızca Claude Code yeniler — güncellemek için herhangi bir Claude Code komutu çalıştırın.',
    ca: 'Només Claude Code renova aquest token — executa qualsevol ordre de Claude Code per actualitzar-lo.',
    bg: 'Само Claude Code обновява този токен — изпълнете произволна команда на Claude Code, за да го обновите.',
    hr: 'Samo Claude Code obnavlja ovaj token — pokreni bilo koju Claude Code naredbu da ga ažuriraš.',
    sr: 'Само Claude Code обнавља овај токен — покрени било коју Claude Code команду да га ажурираш.',
    lt: 'Šį raktą atnaujina tik Claude Code — paleiskite bet kurią Claude Code komandą jam atnaujinti.',
    ja: 'このトークンを更新できるのは Claude Code だけです。任意の Claude Code コマンドを実行して更新してください。',
    ko: '이 토큰은 Claude Code만 갱신합니다. 아무 Claude Code 명령을 실행해 갱신하세요.',
    zh: '只有 Claude Code 能续期此令牌——运行任意 Claude Code 命令即可更新。',
    vi: 'Chỉ Claude Code mới làm mới token này — chạy bất kỳ lệnh Claude Code nào để cập nhật.',
    th: 'มีเพียง Claude Code ที่ต่ออายุโทเค็นนี้ได้ — รันคำสั่ง Claude Code ใดก็ได้เพื่ออัปเดต',
    id: 'Hanya Claude Code yang memperbarui token ini — jalankan perintah Claude Code apa pun untuk memperbaruinya.',
    ms: 'Hanya Claude Code memperbaharui token ini — jalankan sebarang arahan Claude Code untuk mengemas kininya.',
    fil: 'Claude Code lang ang nag-re-refresh ng token na ito — magpatakbo ng anumang Claude Code command para i-update ito.',
    hi: 'इस टोकन को केवल Claude Code नवीनीकृत करता है — इसे अपडेट करने के लिए कोई भी Claude Code कमांड चलाएँ।',
    ar: 'يُجدِّد هذا الرمز Claude Code فقط — شغِّل أي أمر من Claude Code لتحديثه.',
    he: 'רק Claude Code מחדש את הטוקן הזה — הריצו פקודת Claude Code כלשהי כדי לעדכן אותו.',
    fa: 'فقط Claude Code این توکن را تازه می‌کند — هر فرمان Claude Code را اجرا کنید تا به‌روز شود.',
  };
  for (const k in EXPIRED_HINT) if (DICT[k]) DICT[k].expired_hint = EXPIRED_HINT[k];

  // statusLine source is the default but isn't wired up yet: a one-time setup, not
  // an "open Claude Code" nudge. Only en/pt for now — other locales fall back to
  // English via t() (full translations are a follow-up).
  const SETUP = { en: 'set up statusLine', pt: 'configure o statusLine' };
  for (const k in SETUP) if (DICT[k]) DICT[k].setup = SETUP[k];

  // Configured but never executed. statusLine is a feature of the Claude Code
  // CLI's terminal UI: the IDE extension panel (VS Code, Cursor, Antigravity…)
  // and the desktop app never run it, so a user on those surfaces has a perfect
  // settings.json and no data. Reported at Discord, and the old "set up
  // statusLine" wording sent them to fix what was already correct.
  const NOTRUN = { en: 'run Claude Code in a terminal', pt: 'rode o Claude Code num terminal' };
  for (const k in NOTRUN) if (DICT[k]) DICT[k].notrun = NOTRUN[k];

  const NOTRUN_HINT = {
    en: 'Your statusLine is set up correctly — Claude Code just hasn’t run it. statusLine only exists in the terminal CLI, not the IDE extension panel or the desktop app. Run `claude` in a terminal (your IDE’s built-in one works) and send one message.',
    pt: 'Seu statusLine está configurado certo — o Claude Code só nunca o executou. statusLine só existe na CLI de terminal, não no painel da extensão nem no app desktop. Rode `claude` num terminal (o embutido do seu IDE serve) e envie uma mensagem.',
  };
  for (const k in NOTRUN_HINT) if (DICT[k]) DICT[k].notrun_hint = NOTRUN_HINT[k];

  const SETUP_HINT = {
    en: 'Open Settings → Data source and set the shown command as your statusLine in Claude Code (settings.json). No token, no endpoint — the Terms-safe source.',
    pt: 'Abra Configurações → Fonte de dados e defina o comando exibido como seu statusLine no Claude Code (settings.json). Sem token, sem endpoint — a fonte segura quanto aos Termos.',
  };
  for (const k in SETUP_HINT) if (DICT[k]) DICT[k].setup_hint = SETUP_HINT[k];

  // statusLine "updated HH:MM" hover: it's the last Claude Code activity, not a
  // web-live figure. en/pt; other locales fall back to English via t().
  const UPDATED_HINT = {
    en: 'as of your last Claude Code activity — the statusLine source only refreshes while a session is generating, so it can trail Claude web while idle',
    pt: 'referente à sua última atividade no Claude Code — a fonte statusLine só atualiza enquanto uma sessão está gerando, então pode ficar atrás do Claude web enquanto ocioso',
  };
  for (const k in UPDATED_HINT) if (DICT[k]) DICT[k].updated_hint = UPDATED_HINT[k];

  // One-click statusLine setup (Settings): write the command into Claude Code's
  // settings.json for the user. en/pt for now; other locales fall back to en.
  const SL = {
    sl_configure:    { en: 'Configure automatically',                                pt: 'Configurar automaticamente' },
    sl_working:      { en: 'Writing…',                                               pt: 'Gravando…' },
    sl_done:         { en: '✓ statusLine configured in Claude Code',                 pt: '✓ statusLine configurado no Claude Code' },
    sl_done_no_node: { en: '✓ written — but `node` isn’t on your PATH, so Claude Code can’t run it yet (install Node)', pt: '✓ gravado — mas `node` não está no seu PATH, então o Claude Code ainda não roda (instale o Node)' },
    sl_already:      { en: '✓ already configured',                                   pt: '✓ já está configurado' },
    // "already configured" but node is missing is the exact broken setup the user
    // is here to troubleshoot — the command is `node "script"`, so it never runs
    // and the widget stays empty. Don't report it as success with no lead.
    sl_already_no_node: { en: 'configured — but `node` isn’t on your PATH, so Claude Code can’t run it (install Node)', pt: 'configurado — mas `node` não está no seu PATH, então o Claude Code não consegue rodar (instale o Node)' },
    sl_replace_q:    { en: 'You already have a statusLine set in Claude Code. Replace it?', pt: 'Você já tem um statusLine no Claude Code. Substituir?' },
    sl_replace:      { en: 'Replace',                                                pt: 'Substituir' },
    sl_cancel:       { en: 'Cancel',                                                 pt: 'Cancelar' },
    sl_err_unreadable: { en: 'Your settings.json isn’t valid JSON — left untouched; edit it by hand', pt: 'Seu settings.json não é JSON válido — não foi alterado; edite à mão' },
    sl_err_write:    { en: 'Couldn’t write settings.json',                           pt: 'Não consegui gravar o settings.json' },
    // Distinct from "couldn't write": the file exists but wouldn't open (another
    // program holding it — antivirus, a backup pass, Claude Code writing it right
    // then). Nothing was touched, and retrying in a moment usually just works —
    // so don't send them off to edit JSON by hand like the unreadable case does.
    sl_err_read:     { en: 'Couldn’t read your settings.json — another program may have it open; nothing was changed, try again', pt: 'Não consegui ler seu settings.json — outro programa pode estar com ele aberto; nada foi alterado, tente de novo' },
    source_moved: {
      en: 'Your data source was moved to the Claude Code statusLine. It had been set to the Anthropic endpoint by an earlier version without ever asking you — that source reads your Claude credential and is against Anthropic’s Consumer Terms. Pick it again above if you want it.',
      pt: 'Sua fonte de dados foi movida para o statusLine do Claude Code. Ela tinha sido definida como Anthropic endpoint por uma versão anterior sem nunca te perguntar — essa fonte lê sua credencial do Claude e vai contra os Termos de Consumidor da Anthropic. Selecione de novo acima se quiser usá-la.',
    },
    endpoint_understand: { en: 'I understand — use it',                             pt: 'Entendo — usar mesmo assim' },
    endpoint_tos_warn: {
      en: "The Anthropic endpoint source reads your local Claude credential to call an internal usage endpoint. This is against Anthropic’s Consumer Terms and has led to account bans — use it at your own risk.",
      pt: "A fonte Anthropic endpoint lê sua credencial local do Claude para chamar um endpoint interno de uso. Isso vai contra os Termos de Consumidor da Anthropic e já resultou em banimentos de conta — use por sua conta e risco.",
    },
  };
  for (const key in SL) for (const k in SL[key]) if (DICT[k]) DICT[k][key] = SL[key][k];

  // First-run onboarding card (widget): a fresh install shows nothing until the
  // statusLine is wired up, so walk the user straight to the one-click setup
  // instead of hoping they find Settings → Data source. en/pt for now; other
  // locales fall back to English via t().
  const OB = {
    ob_title: { en: 'One-time setup', pt: 'Configuração única' },
    ob_text: {
      en: 'The widget reads its numbers from Claude Code’s statusLine. Wire it up once and you’re set.',
      pt: 'O widget lê os números do statusLine do Claude Code. Configure uma vez e pronto.',
    },
    ob_later: { en: 'Later', pt: 'Depois' },
    ob_done: {
      en: '✓ Done — now open Claude Code and send any message; the numbers appear when it responds.',
      pt: '✓ Pronto — abra o Claude Code e envie qualquer mensagem; os números aparecem quando ele responder.',
    },
    ob_insettings: {
      en: 'You already have a statusLine set in Claude Code — finish in Settings → Data source.',
      pt: 'Você já tem um statusLine no Claude Code — conclua em Configurações → Fonte de dados.',
    },
  };
  for (const key in OB) for (const k in OB[key]) if (DICT[k]) DICT[k][key] = OB[key][k];

  // paid overage (prefix before the amount: "extra R$12,30")
  const OVERAGE = {
    en: 'extra', es: 'extra', pt: 'extra', fr: 'extra', de: 'Zusatz', it: 'extra',
    nl: 'extra', pl: 'nadwyżka', ru: 'сверх', uk: 'понад', cs: 'navíc', sk: 'navyše',
    ro: 'extra', hu: 'extra', el: 'επιπλέον', sv: 'extra', da: 'ekstra', fi: 'lisä',
    nb: 'ekstra', tr: 'ek', ca: 'extra', bg: 'свръх', hr: 'višak', sr: 'вишак',
    lt: 'viršija', ja: '超過', ko: '초과', zh: '超额', vi: 'vượt', th: 'เกินโควตา',
    id: 'ekstra', ms: 'lebihan', fil: 'sobra', hi: 'अतिरिक्त', ar: 'زائد', he: 'חריגה',
    fa: 'اضافه',
  };
  for (const k in OVERAGE) if (DICT[k]) DICT[k].overage = OVERAGE[k];

  const THEME = {
    en: 'Theme', es: 'Tema', pt: 'Tema', fr: 'Thème', de: 'Design', it: 'Tema',
    nl: 'Thema', pl: 'Motyw', ru: 'Тема', uk: 'Тема', cs: 'Motiv', sk: 'Motív',
    ro: 'Temă', hu: 'Téma', el: 'Θέμα', sv: 'Tema', da: 'Tema', fi: 'Teema',
    nb: 'Tema', tr: 'Tema', ca: 'Tema', bg: 'Тема', hr: 'Tema', sr: 'Тема',
    lt: 'Tema', ja: 'テーマ', ko: '테마', zh: '主题', vi: 'Giao diện', th: 'ธีม',
    id: 'Tema', ms: 'Tema', fil: 'Tema', hi: 'थीम', ar: 'السمة', he: 'ערכת נושא',
    fa: 'پوسته',
  };
  for (const k in THEME) if (DICT[k]) DICT[k].set_theme = THEME[k];

  const UPDATE = {
    en: 'Update & restart', es: 'Actualizar y reiniciar', pt: 'Atualizar e reiniciar',
    fr: 'Mettre à jour et redémarrer', de: 'Aktualisieren & neu starten', it: 'Aggiorna e riavvia',
    nl: 'Bijwerken & herstarten', pl: 'Zaktualizuj i uruchom ponownie', ru: 'Обновить и перезапустить',
    uk: 'Оновити й перезапустити', cs: 'Aktualizovat a restartovat', sk: 'Aktualizovať a reštartovať',
    ro: 'Actualizează și repornește', hu: 'Frissítés és újraindítás', el: 'Ενημέρωση & επανεκκίνηση',
    sv: 'Uppdatera & starta om', da: 'Opdater & genstart', fi: 'Päivitä ja käynnistä uudelleen',
    nb: 'Oppdater og start på nytt', tr: 'Güncelle ve yeniden başlat', ca: 'Actualitza i reinicia',
    bg: 'Обнови и рестартирай', hr: 'Ažuriraj i ponovno pokreni', sr: 'Ажурирај и поново покрени',
    lt: 'Atnaujinti ir paleisti iš naujo', ja: '更新して再起動', ko: '업데이트 후 재시작',
    zh: '更新并重启', vi: 'Cập nhật & khởi động lại', th: 'อัปเดตและรีสตาร์ต',
    id: 'Perbarui & mulai ulang', ms: 'Kemas kini & mula semula', fil: 'I-update at i-restart',
    hi: 'अपडेट करें और पुनः आरंभ करें', ar: 'تحديث وإعادة تشغيل', he: 'עדכן והפעל מחדש',
    fa: 'به‌روزرسانی و راه‌اندازی مجدد',
  };
  for (const k in UPDATE) if (DICT[k]) DICT[k].update_restart = UPDATE[k];

  // Tray item shown when a new release exists but nothing was downloaded yet
  // (consent-first updates: the user starts the download explicitly).
  const UPDATE_DL = {
    en: 'Download update', es: 'Descargar actualización', pt: 'Baixar atualização',
    fr: 'Télécharger la mise à jour', de: 'Update herunterladen', it: "Scarica l'aggiornamento",
    nl: 'Update downloaden', pl: 'Pobierz aktualizację', ru: 'Скачать обновление',
    uk: 'Завантажити оновлення', cs: 'Stáhnout aktualizaci', sk: 'Stiahnuť aktualizáciu',
    ro: 'Descarcă actualizarea', hu: 'Frissítés letöltése', el: 'Λήψη ενημέρωσης',
    sv: 'Ladda ner uppdatering', da: 'Download opdatering', fi: 'Lataa päivitys',
    nb: 'Last ned oppdatering', tr: 'Güncellemeyi indir', ca: "Baixa l'actualització",
    bg: 'Изтегли актуализацията', hr: 'Preuzmi ažuriranje', sr: 'Преузми ажурирање',
    lt: 'Atsisiųsti atnaujinimą', ja: '更新をダウンロード', ko: '업데이트 다운로드',
    zh: '下载更新', vi: 'Tải bản cập nhật', th: 'ดาวน์โหลดอัปเดต',
    id: 'Unduh pembaruan', ms: 'Muat turun kemas kini', fil: 'I-download ang update',
    hi: 'अपडेट डाउनलोड करें', ar: 'تنزيل التحديث', he: 'הורד עדכון',
    fa: 'دانلود به‌روزرسانی',
  };
  for (const k in UPDATE_DL) if (DICT[k]) DICT[k].update_download = UPDATE_DL[k];

  // Manual "check for updates" — Settings block + tray item and its result
  // states. Provided in English and Portuguese; other locales fall back to
  // English via t()'s fallback (full translations are a follow-up).
  Object.assign(DICT.en, {
    set_updates: 'Updates',
    update_check: 'Check for updates',
    update_checking: 'Checking…',
    update_uptodate: 'You’re on the latest version',
    update_found: 'Update available',
    update_check_error: 'Couldn’t check — try again',
    // runManualCheck() short-circuits when a download is already running or a
    // tray-initiated check holds the latch. Both used to fall through to
    // "you're on the latest version" — a flat lie while a newer build downloads.
    update_downloading: 'Downloading update…',
    update_check_busy: 'A check is already running…',
  });
  if (DICT.pt) Object.assign(DICT.pt, {
    set_updates: 'Atualizações',
    update_check: 'Verificar atualizações',
    update_checking: 'Verificando…',
    update_uptodate: 'Você está na versão mais recente',
    update_found: 'Atualização disponível',
    update_check_error: 'Não foi possível verificar — tente de novo',
    update_downloading: 'Baixando atualização…',
    update_check_busy: 'Já tem uma verificação em andamento…',
  });

  // Circuit breaker tripped: the usage endpoint keeps refusing, so polling
  // stopped. Short status + honest tooltip with the retry gesture.
  const UNAVAILABLE = {
    en: 'usage unavailable', es: 'uso no disponible', pt: 'uso indisponível',
    fr: 'usage indisponible', de: 'Nutzung nicht verfügbar', it: 'utilizzo non disponibile',
    nl: 'gebruik niet beschikbaar', pl: 'zużycie niedostępne', ru: 'данные недоступны',
    uk: 'дані недоступні', cs: 'údaje nedostupné', sk: 'údaje nedostupné',
    ro: 'utilizare indisponibilă', hu: 'a használat nem érhető el', el: 'μη διαθέσιμη χρήση',
    sv: 'användning otillgänglig', da: 'forbrug utilgængeligt', fi: 'käyttö ei saatavilla',
    nb: 'forbruk utilgjengelig', tr: 'kullanım alınamıyor', ca: 'ús no disponible',
    bg: 'данните са недостъпни', hr: 'podaci nedostupni', sr: 'подаци недоступни',
    lt: 'duomenys nepasiekiami', ja: '使用状況を取得できません', ko: '사용량을 가져올 수 없음',
    zh: '无法获取用量', vi: 'không lấy được mức dùng', th: 'ดึงข้อมูลการใช้งานไม่ได้',
    id: 'data pemakaian tak tersedia', ms: 'data penggunaan tiada', fil: 'hindi makuha ang usage',
    hi: 'उपयोग डेटा अनुपलब्ध', ar: 'الاستخدام غير متاح', he: 'נתוני שימוש לא זמינים',
    fa: 'داده مصرف در دسترس نیست',
  };
  for (const k in UNAVAILABLE) if (DICT[k]) DICT[k].unavailable = UNAVAILABLE[k];

  const UNAVAILABLE_HINT = {
    en: 'The usage endpoint stopped answering (it may have changed or closed). Checks are paused — press ↻ to try again.',
    es: 'El endpoint de uso dejó de responder (puede haber cambiado o cerrado). Las consultas están en pausa: pulsa ↻ para reintentar.',
    pt: 'O endpoint de uso parou de responder (pode ter mudado ou sido fechado). As consultas estão pausadas — toque em ↻ para tentar de novo.',
    fr: "Le point d'accès d'usage ne répond plus (il a peut-être changé ou fermé). Les requêtes sont en pause — appuyez sur ↻ pour réessayer.",
    de: 'Der Nutzungs-Endpunkt antwortet nicht mehr (er wurde evtl. geändert oder geschlossen). Abfragen sind pausiert – mit ↻ erneut versuchen.',
    it: "L'endpoint di utilizzo ha smesso di rispondere (potrebbe essere cambiato o chiuso). Le richieste sono in pausa — premi ↻ per riprovare.",
    nl: 'Het gebruiks-endpoint reageert niet meer (mogelijk gewijzigd of gesloten). Controles zijn gepauzeerd — druk op ↻ om opnieuw te proberen.',
    pl: 'Endpoint zużycia przestał odpowiadać (mógł się zmienić lub zostać zamknięty). Odpytywanie wstrzymane — naciśnij ↻, aby spróbować ponownie.',
    ru: 'Эндпоинт использования перестал отвечать (возможно, изменился или закрыт). Опрос приостановлен — нажмите ↻, чтобы попробовать снова.',
    uk: 'Ендпоінт використання перестав відповідати (можливо, змінився або закритий). Опитування призупинено — натисніть ↻, щоб спробувати ще раз.',
    cs: 'Endpoint využití přestal odpovídat (možná se změnil nebo byl uzavřen). Dotazy jsou pozastaveny — stiskněte ↻ pro nový pokus.',
    sk: 'Endpoint využitia prestal odpovedať (možno sa zmenil alebo bol uzavretý). Dopyty sú pozastavené — stlačte ↻ a skúste znova.',
    ro: 'Endpointul de utilizare nu mai răspunde (poate s-a schimbat sau a fost închis). Interogările sunt în pauză — apasă ↻ pentru a reîncerca.',
    hu: 'A használati végpont nem válaszol (lehet, hogy megváltozott vagy lezárták). A lekérdezések szünetelnek — nyomd meg a ↻ gombot az újrapróbáláshoz.',
    el: 'Το endpoint χρήσης σταμάτησε να αποκρίνεται (ίσως άλλαξε ή έκλεισε). Οι έλεγχοι είναι σε παύση — πάτησε ↻ για νέα προσπάθεια.',
    sv: 'Användnings-endpointen svarar inte längre (den kan ha ändrats eller stängts). Kontrollerna är pausade — tryck ↻ för att försöka igen.',
    da: 'Forbrugs-endpointet svarer ikke længere (det kan være ændret eller lukket). Tjek er sat på pause — tryk ↻ for at prøve igen.',
    fi: 'Käyttöpiste lakkasi vastaamasta (se on voinut muuttua tai sulkeutua). Kyselyt on keskeytetty — paina ↻ yrittääksesi uudelleen.',
    nb: 'Forbruks-endepunktet svarer ikke lenger (det kan ha endret seg eller blitt stengt). Sjekker er satt på pause — trykk ↻ for å prøve igjen.',
    tr: 'Kullanım uç noktası yanıt vermeyi bıraktı (değişmiş veya kapatılmış olabilir). Sorgular duraklatıldı — yeniden denemek için ↻ tuşuna basın.',
    ca: "L'endpoint d'ús ha deixat de respondre (pot haver canviat o tancat). Les consultes estan en pausa — prem ↻ per tornar-ho a provar.",
    bg: 'Ендпойнтът за използване спря да отговаря (може да е променен или затворен). Проверките са на пауза — натиснете ↻, за да опитате отново.',
    hr: 'Endpoint potrošnje prestao je odgovarati (možda je promijenjen ili zatvoren). Provjere su pauzirane — pritisni ↻ za novi pokušaj.',
    sr: 'Ендпоинт потрошње је престао да одговара (можда је промењен или затворен). Провере су паузиране — притисни ↻ за нови покушај.',
    lt: 'Naudojimo prieigos taškas nebeatsako (galėjo pasikeisti ar būti uždarytas). Užklausos pristabdytos — paspauskite ↻, kad bandytumėte dar kartą.',
    ja: '使用状況エンドポイントが応答しなくなりました（変更または閉鎖された可能性があります）。確認は一時停止中です。↻ を押して再試行してください。',
    ko: '사용량 엔드포인트가 응답하지 않습니다(변경되었거나 닫혔을 수 있음). 확인이 일시 중지됨 — ↻을 눌러 다시 시도하세요.',
    zh: '用量接口不再响应（可能已更改或关闭）。查询已暂停——按 ↻ 重试。',
    vi: 'Endpoint mức dùng không còn phản hồi (có thể đã thay đổi hoặc bị đóng). Truy vấn đã tạm dừng — nhấn ↻ để thử lại.',
    th: 'จุดเชื่อมต่อข้อมูลการใช้งานหยุดตอบสนอง (อาจถูกเปลี่ยนหรือปิดไปแล้ว) การตรวจสอบถูกหยุดชั่วคราว — กด ↻ เพื่อลองอีกครั้ง',
    id: 'Endpoint pemakaian berhenti merespons (mungkin berubah atau ditutup). Pemeriksaan dijeda — tekan ↻ untuk mencoba lagi.',
    ms: 'Endpoint penggunaan berhenti membalas (mungkin berubah atau ditutup). Semakan dijeda — tekan ↻ untuk cuba lagi.',
    fil: 'Huminto sa pagsagot ang usage endpoint (maaaring nagbago o isinara na). Naka-pause ang pag-check — pindutin ang ↻ para subukan ulit.',
    hi: 'उपयोग एंडपॉइंट ने जवाब देना बंद कर दिया (यह बदल गया या बंद हो गया हो सकता है)। जाँच रुकी हुई है — फिर से कोशिश करने के लिए ↻ दबाएँ।',
    ar: 'توقف مسار الاستخدام عن الاستجابة (ربما تغيّر أو أُغلق). الفحوصات متوقفة مؤقتًا — اضغط ↻ لإعادة المحاولة.',
    he: 'נקודת הקצה של השימוש הפסיקה להגיב (ייתכן שהשתנתה או נסגרה). הבדיקות מושהות — לחצו ↻ כדי לנסות שוב.',
    fa: 'نقطه پایانی مصرف دیگر پاسخ نمی‌دهد (شاید تغییر کرده یا بسته شده باشد). بررسی‌ها متوقف شده‌اند — برای تلاش دوباره ↻ را بزنید.',
  };
  for (const k in UNAVAILABLE_HINT) if (DICT[k]) DICT[k].unavailable_hint = UNAVAILABLE_HINT[k];

  // Fine-detail pane (extended mode): the more/less toggle, the scoped-limit
  // section title, and the 7-day cost rows.
  const MORE = {
    en: 'more details', es: 'más detalles', pt: 'mais detalhes', fr: 'plus de détails',
    de: 'mehr Details', it: 'più dettagli', nl: 'meer details', pl: 'więcej szczegółów',
    ru: 'подробнее', uk: 'докладніше', cs: 'více podrobností', sk: 'viac podrobností',
    ro: 'mai multe detalii', hu: 'több részlet', el: 'περισσότερες λεπτομέρειες', sv: 'fler detaljer',
    da: 'flere detaljer', fi: 'lisätiedot', nb: 'flere detaljer', tr: 'daha fazla ayrıntı',
    ca: 'més detalls', bg: 'повече детайли', hr: 'više detalja', sr: 'више детаља',
    lt: 'daugiau informacijos', ja: '詳細を表示', ko: '자세히 보기', zh: '更多详情',
    vi: 'chi tiết hơn', th: 'รายละเอียดเพิ่มเติม', id: 'detail lainnya', ms: 'butiran lanjut',
    fil: 'higit pang detalye', hi: 'और विवरण', ar: 'مزيد من التفاصيل', he: 'פרטים נוספים',
    fa: 'جزئیات بیشتر',
  };
  for (const k in MORE) if (DICT[k]) DICT[k].t_more = MORE[k];

  const LESS = {
    en: 'fewer details', es: 'menos detalles', pt: 'menos detalhes', fr: 'moins de détails',
    de: 'weniger Details', it: 'meno dettagli', nl: 'minder details', pl: 'mniej szczegółów',
    ru: 'свернуть', uk: 'згорнути', cs: 'méně podrobností', sk: 'menej podrobností',
    ro: 'mai puține detalii', hu: 'kevesebb részlet', el: 'λιγότερες λεπτομέρειες', sv: 'färre detaljer',
    da: 'færre detaljer', fi: 'vähemmän tietoja', nb: 'færre detaljer', tr: 'daha az ayrıntı',
    ca: 'menys detalls', bg: 'по-малко детайли', hr: 'manje detalja', sr: 'мање детаља',
    lt: 'mažiau informacijos', ja: '詳細を隠す', ko: '간단히 보기', zh: '收起详情',
    vi: 'thu gọn', th: 'ย่อรายละเอียด', id: 'lebih sedikit detail', ms: 'kurang butiran',
    fil: 'mas kaunting detalye', hi: 'कम विवरण', ar: 'تفاصيل أقل', he: 'פחות פרטים',
    fa: 'جزئیات کمتر',
  };
  for (const k in LESS) if (DICT[k]) DICT[k].t_less = LESS[k];

  const AVG7 = {
    en: 'avg / day (7d)', es: 'media/día (7d)', pt: 'média/dia (7d)', fr: 'moy./jour (7j)',
    de: 'Ø/Tag (7T)', it: 'media/giorno (7g)', nl: 'gem./dag (7d)', pl: 'śr./dzień (7d)',
    ru: 'сред./день (7д)', uk: 'серед./день (7д)', cs: 'prům./den (7d)', sk: 'priem./deň (7d)',
    ro: 'medie/zi (7z)', hu: 'átlag/nap (7n)', el: 'μ.ό./ημέρα (7ημ)', sv: 'snitt/dag (7d)',
    da: 'gns./dag (7d)', fi: 'ka./päivä (7pv)', nb: 'snitt/dag (7d)', tr: 'ort./gün (7g)',
    ca: 'mitjana/dia (7d)', bg: 'ср./ден (7д)', hr: 'pros./dan (7d)', sr: 'прос./дан (7д)',
    lt: 'vid./dienai (7d)', ja: '日平均（7日）', ko: '일평균(7일)', zh: '日均（7天）',
    vi: 'TB/ngày (7n)', th: 'เฉลี่ย/วัน (7วัน)', id: 'rata-rata/hari (7h)', ms: 'purata/hari (7h)',
    fil: 'avg/araw (7a)', hi: 'औसत/दिन (7दि)', ar: 'متوسط/يوم (7أيام)', he: 'ממוצע/יום (7י)',
    fa: 'میانگین/روز (۷روز)',
  };
  for (const k in AVG7) if (DICT[k]) DICT[k].avg_7d = AVG7[k];

  const LAST7 = {
    en: 'last 7 days', es: 'últimos 7 días', pt: 'últimos 7 dias', fr: '7 derniers jours',
    de: 'letzte 7 Tage', it: 'ultimi 7 giorni', nl: 'afgelopen 7 dagen', pl: 'ostatnie 7 dni',
    ru: 'последние 7 дней', uk: 'останні 7 днів', cs: 'posledních 7 dní', sk: 'posledných 7 dní',
    ro: 'ultimele 7 zile', hu: 'elmúlt 7 nap', el: 'τελευταίες 7 ημέρες', sv: 'senaste 7 dagarna',
    da: 'seneste 7 dage', fi: 'viimeiset 7 päivää', nb: 'siste 7 dager', tr: 'son 7 gün',
    ca: 'últims 7 dies', bg: 'последните 7 дни', hr: 'zadnjih 7 dana', sr: 'последњих 7 дана',
    lt: 'paskutinės 7 dienos', ja: '過去7日間', ko: '지난 7일', zh: '过去 7 天',
    vi: '7 ngày qua', th: '7 วันที่ผ่านมา', id: '7 hari terakhir', ms: '7 hari lepas',
    fil: 'nakaraang 7 araw', hi: 'पिछले 7 दिन', ar: 'آخر 7 أيام', he: '7 הימים האחרונים',
    fa: '۷ روز گذشته',
  };
  for (const k in LAST7) if (DICT[k]) DICT[k].last_7d = LAST7[k];

  // label for JSONL lines whose model ID matches no known tier
  const TIER_OTHER = {
    en: 'other', es: 'otros', pt: 'outros', fr: 'autres', de: 'andere', it: 'altri',
    nl: 'overig', pl: 'inne', ru: 'другие', uk: 'інші', cs: 'ostatní', sk: 'ostatné',
    ro: 'altele', hu: 'egyéb', el: 'άλλα', sv: 'övriga', da: 'andre', fi: 'muut',
    nb: 'andre', tr: 'diğer', ca: 'altres', bg: 'други', hr: 'ostalo', sr: 'остало',
    lt: 'kita', ja: 'その他', ko: '기타', zh: '其他', vi: 'khác', th: 'อื่นๆ',
    id: 'lainnya', ms: 'lain-lain', fil: 'iba pa', hi: 'अन्य', ar: 'أخرى', he: 'אחר',
    fa: 'سایر',
  };
  for (const k in TIER_OTHER) if (DICT[k]) DICT[k].tier_other = TIER_OTHER[k];

  // Fine-detail pane, round two: what today's cache reads would have cost as
  // regular input, and today's cost extrapolated to the full day.
  const CACHE_SAVINGS = {
    en: 'cache savings', es: 'ahorro por caché', pt: 'economia de cache', fr: 'économies de cache',
    de: 'Cache-Ersparnis', it: 'risparmio cache', nl: 'cachebesparing', pl: 'oszczędność cache',
    ru: 'экономия кэша', uk: 'економія кешу', cs: 'úspora cache', sk: 'úspora cache',
    ro: 'economie cache', hu: 'cache-megtakarítás', el: 'εξοικονόμηση cache', sv: 'cachebesparing',
    da: 'cachebesparelse', fi: 'välimuistisäästö', nb: 'cachebesparelse', tr: 'önbellek tasarrufu',
    ca: 'estalvi per memòria cau', bg: 'спестено от кеш', hr: 'ušteda cachea', sr: 'уштеда кеша',
    lt: 'talpyklos sutaupymas', ja: 'キャッシュ節約', ko: '캐시 절감', zh: '缓存节省',
    vi: 'tiết kiệm nhờ cache', th: 'ประหยัดจากแคช', id: 'penghematan cache', ms: 'penjimatan cache',
    fil: 'natipid sa cache', hi: 'कैश बचत', ar: 'توفير الذاكرة المؤقتة', he: 'חיסכון ממטמון',
    fa: 'صرفه‌جویی کش',
  };
  for (const k in CACHE_SAVINGS) if (DICT[k]) DICT[k].cache_savings = CACHE_SAVINGS[k];

  const DAY_PROJ = {
    en: 'projected today', es: 'proyección del día', pt: 'projeção do dia', fr: 'projection du jour',
    de: 'Tagesprognose', it: 'proiezione del giorno', nl: 'prognose vandaag', pl: 'prognoza dnia',
    ru: 'прогноз на день', uk: 'прогноз на день', cs: 'denní odhad', sk: 'denný odhad',
    ro: 'proiecția zilei', hu: 'napi előrejelzés', el: 'πρόβλεψη ημέρας', sv: 'prognos idag',
    da: 'prognose i dag', fi: 'päiväennuste', nb: 'prognose i dag', tr: 'günlük tahmin',
    ca: 'projecció del dia', bg: 'прогноза за деня', hr: 'projekcija dana', sr: 'пројекција дана',
    lt: 'dienos prognozė', ja: '本日の予測', ko: '오늘 예상', zh: '今日预计',
    vi: 'dự kiến hôm nay', th: 'คาดการณ์วันนี้', id: 'proyeksi hari ini', ms: 'unjuran hari ini',
    fil: 'tinatayang ngayong araw', hi: 'आज का अनुमान', ar: 'توقع اليوم', he: 'תחזית להיום',
    fa: 'برآورد امروز',
  };
  for (const k in DAY_PROJ) if (DICT[k]) DICT[k].day_projection = DAY_PROJ[k];

  // API-key / Console login: subscription usage windows don't exist for those
  // accounts — a steady state, not an error. The token panel still works.
  const NOCRED = {
    en: 'API account — no usage windows', es: 'cuenta API — sin ventanas de uso',
    pt: 'conta API — sem janelas de uso', fr: 'compte API — pas de fenêtres d’usage',
    de: 'API-Konto — keine Nutzungsfenster', it: 'account API — nessuna finestra di utilizzo',
    nl: 'API-account — geen gebruiksvensters', pl: 'konto API — brak okien zużycia',
    ru: 'API-аккаунт — нет окон лимитов', uk: 'API-акаунт — немає вікон лімітів',
    cs: 'API účet — bez oken využití', sk: 'API účet — bez okien využitia',
    ro: 'cont API — fără ferestre de utilizare', hu: 'API-fiók — nincsenek használati ablakok',
    el: 'λογαριασμός API — χωρίς παράθυρα χρήσης', sv: 'API-konto — inga användningsfönster',
    da: 'API-konto — ingen forbrugsvinduer', fi: 'API-tili — ei käyttöikkunoita',
    nb: 'API-konto — ingen bruksvinduer', tr: 'API hesabı — kullanım penceresi yok',
    ca: 'compte API — sense finestres d’ús', bg: 'API акаунт — без прозорци за използване',
    hr: 'API račun — bez prozora potrošnje', sr: 'API налог — без прозора потрошње',
    lt: 'API paskyra — nėra naudojimo langų', ja: 'APIアカウント — 使用枠なし',
    ko: 'API 계정 — 사용량 창 없음', zh: 'API 账户 — 无用量窗口',
    vi: 'tài khoản API — không có khung mức dùng', th: 'บัญชี API — ไม่มีกรอบการใช้งาน',
    id: 'akun API — tanpa jendela pemakaian', ms: 'akaun API — tiada tetingkap penggunaan',
    fil: 'API account — walang usage window', hi: 'API खाता — उपयोग विंडो नहीं',
    ar: 'حساب API — لا نوافذ استخدام', he: 'חשבון API — אין חלונות שימוש',
    fa: 'حساب API — بدون پنجره مصرف',
  };
  for (const k in NOCRED) if (DICT[k]) DICT[k].nocred = NOCRED[k];

  const NOCRED_HINT = {
    en: 'This Claude Code login uses an API key (Console billing), which has no 5-hour/weekly windows. The Claude Code token panel below still works.',
    es: 'Este inicio de sesión de Claude Code usa una API key (facturación por Console), que no tiene ventanas de 5 horas/semana. El panel de tokens de Claude Code sigue funcionando.',
    pt: 'Este login do Claude Code usa API key (cobrança via Console), que não tem janelas de 5h/semana. O painel de tokens do Claude Code continua funcionando.',
    fr: 'Cette session Claude Code utilise une clé API (facturation Console), sans fenêtres de 5 h/semaine. Le panneau de jetons Claude Code fonctionne toujours.',
    de: 'Dieser Claude-Code-Login nutzt einen API-Schlüssel (Console-Abrechnung) ohne 5-Stunden-/Wochenfenster. Das Claude-Code-Token-Panel funktioniert weiterhin.',
    it: 'Questo accesso a Claude Code usa una API key (fatturazione Console), senza finestre di 5 ore/settimana. Il pannello dei token di Claude Code continua a funzionare.',
    nl: 'Deze Claude Code-login gebruikt een API-sleutel (Console-facturering), zonder 5-uurs/weekvensters. Het Claude Code-tokenpaneel blijft werken.',
    pl: 'To logowanie Claude Code używa klucza API (rozliczenia Console), bez okien 5-godzinnych/tygodniowych. Panel tokenów Claude Code nadal działa.',
    ru: 'Этот вход в Claude Code использует API-ключ (оплата через Console), у которого нет окон 5 часов/неделя. Панель токенов Claude Code продолжает работать.',
    uk: 'Цей вхід у Claude Code використовує API-ключ (оплата через Console), без вікон 5 годин/тиждень. Панель токенів Claude Code далі працює.',
    cs: 'Toto přihlášení Claude Code používá API klíč (účtování přes Console), bez oken 5 hodin/týden. Panel tokenů Claude Code dál funguje.',
    sk: 'Toto prihlásenie Claude Code používa API kľúč (účtovanie cez Console), bez okien 5 hodín/týždeň. Panel tokenov Claude Code ďalej funguje.',
    ro: 'Această autentificare Claude Code folosește o cheie API (facturare Console), fără ferestre de 5 ore/săptămână. Panoul de tokenuri Claude Code funcționează în continuare.',
    hu: 'Ez a Claude Code-bejelentkezés API-kulcsot használ (Console-számlázás), 5 órás/heti ablakok nélkül. A Claude Code tokenpanel továbbra is működik.',
    el: 'Αυτή η σύνδεση Claude Code χρησιμοποιεί κλειδί API (χρέωση Console), χωρίς παράθυρα 5 ωρών/εβδομάδας. Ο πίνακας token του Claude Code συνεχίζει να λειτουργεί.',
    sv: 'Denna Claude Code-inloggning använder en API-nyckel (Console-fakturering), utan 5-timmars-/veckofönster. Claude Codes tokenpanel fungerar ändå.',
    da: 'Dette Claude Code-login bruger en API-nøgle (Console-fakturering) uden 5-timers-/ugevinduer. Claude Codes tokenpanel virker stadig.',
    fi: 'Tämä Claude Code -kirjautuminen käyttää API-avainta (Console-laskutus), jolla ei ole 5 tunnin/viikon ikkunoita. Claude Coden token-paneeli toimii silti.',
    nb: 'Denne Claude Code-påloggingen bruker en API-nøkkel (Console-fakturering), uten 5-timers-/ukevinduer. Claude Codes token-panel fungerer fortsatt.',
    tr: 'Bu Claude Code oturumu API anahtarı kullanıyor (Console faturalandırması); 5 saat/hafta pencereleri yok. Claude Code jeton paneli çalışmaya devam ediyor.',
    ca: 'Aquest inici de sessió del Claude Code fa servir una clau API (facturació per Console), sense finestres de 5 hores/setmana. El tauler de tokens del Claude Code continua funcionant.',
    bg: 'Този вход в Claude Code използва API ключ (таксуване през Console), без прозорци от 5 часа/седмица. Панелът с токени на Claude Code продължава да работи.',
    hr: 'Ova prijava u Claude Code koristi API ključ (naplata preko Consolea), bez prozora od 5 sati/tjedan. Panel tokena Claude Codea i dalje radi.',
    sr: 'Ова пријава у Claude Code користи API кључ (наплата преко Console-а), без прозора од 5 сати/недеља. Панел токена Claude Code-а и даље ради.',
    lt: 'Šis Claude Code prisijungimas naudoja API raktą (Console apmokestinimas), be 5 val./savaitės langų. Claude Code žetonų skydelis vis tiek veikia.',
    ja: 'この Claude Code ログインは API キー（Console 課金）を使用しており、5時間/週の使用枠はありません。下の Claude Code トークンパネルは引き続き機能します。',
    ko: '이 Claude Code 로그인은 API 키(Console 과금)를 사용하며 5시간/주간 창이 없습니다. 아래 Claude Code 토큰 패널은 계속 작동합니다.',
    zh: '此 Claude Code 登录使用 API 密钥（Console 计费），没有 5 小时/每周用量窗口。下方的 Claude Code 令牌面板仍然可用。',
    vi: 'Phiên đăng nhập Claude Code này dùng API key (thanh toán qua Console), không có khung 5 giờ/tuần. Bảng token Claude Code bên dưới vẫn hoạt động.',
    th: 'การเข้าสู่ระบบ Claude Code นี้ใช้ API key (เรียกเก็บผ่าน Console) จึงไม่มีกรอบ 5 ชั่วโมง/สัปดาห์ แผงโทเคน Claude Code ด้านล่างยังใช้งานได้',
    id: 'Login Claude Code ini memakai API key (penagihan Console), tanpa jendela 5 jam/mingguan. Panel token Claude Code di bawah tetap berfungsi.',
    ms: 'Log masuk Claude Code ini menggunakan kunci API (pengebilan Console), tanpa tetingkap 5 jam/mingguan. Panel token Claude Code masih berfungsi.',
    fil: 'Ang Claude Code login na ito ay gumagamit ng API key (Console billing), walang 5-oras/lingguhang window. Gumagana pa rin ang token panel ng Claude Code.',
    hi: 'यह Claude Code लॉगिन API key (Console बिलिंग) उपयोग करता है, जिसमें 5 घंटे/साप्ताहिक विंडो नहीं होतीं। नीचे का Claude Code टोकन पैनल फिर भी काम करता है।',
    ar: 'يستخدم تسجيل دخول Claude Code هذا مفتاح API (فوترة Console)، بلا نوافذ 5 ساعات/أسبوعية. لوحة رموز Claude Code أدناه تعمل كالمعتاد.',
    he: 'התחברות זו ל-Claude Code משתמשת במפתח API (חיוב Console), ללא חלונות של 5 שעות/שבועי. לוח הטוקנים של Claude Code עדיין עובד.',
    fa: 'این ورود Claude Code از کلید API استفاده می‌کند (صورتحساب Console) و پنجره ۵ ساعته/هفتگی ندارد. پنل توکن Claude Code همچنان کار می‌کند.',
  };
  for (const k in NOCRED_HINT) if (DICT[k]) DICT[k].nocred_hint = NOCRED_HINT[k];

  // Data source selector (Settings): live endpoint vs Claude Code statusLine.
  const SOURCE = {
    en: 'Data source', es: 'Fuente de datos', pt: 'Fonte de dados', fr: 'Source de données',
    de: 'Datenquelle', it: 'Origine dati', nl: 'Gegevensbron', pl: 'Źródło danych',
    ru: 'Источник данных', uk: 'Джерело даних', cs: 'Zdroj dat', sk: 'Zdroj dát',
    ro: 'Sursă de date', hu: 'Adatforrás', el: 'Πηγή δεδομένων', sv: 'Datakälla',
    da: 'Datakilde', fi: 'Tietolähde', nb: 'Datakilde', tr: 'Veri kaynağı',
    ca: 'Font de dades', bg: 'Източник на данни', hr: 'Izvor podataka', sr: 'Извор података',
    lt: 'Duomenų šaltinis', ja: 'データソース', ko: '데이터 소스', zh: '数据来源',
    vi: 'Nguồn dữ liệu', th: 'แหล่งข้อมูล', id: 'Sumber data', ms: 'Sumber data',
    fil: 'Pinagmulan ng data', hi: 'डेटा स्रोत', ar: 'مصدر البيانات', he: 'מקור נתונים',
    fa: 'منبع داده',
  };
  for (const k in SOURCE) if (DICT[k]) DICT[k].set_source = SOURCE[k];

  const SOURCE_HINT = {
    en: 'Use this command as your statusLine in Claude Code (settings.json). Data refreshes only while Claude Code is running.',
    es: 'Usa este comando como tu statusLine en Claude Code (settings.json). Los datos solo se actualizan mientras Claude Code está en ejecución.',
    pt: 'Use este comando como seu statusLine no Claude Code (settings.json). Os dados só atualizam enquanto o Claude Code está rodando.',
    fr: 'Utilisez cette commande comme statusLine dans Claude Code (settings.json). Les données ne se mettent à jour que pendant que Claude Code est en cours d’exécution.',
    de: 'Diesen Befehl als statusLine in Claude Code (settings.json) verwenden. Die Daten aktualisieren sich nur, während Claude Code läuft.',
    it: 'Usa questo comando come statusLine in Claude Code (settings.json). I dati si aggiornano solo mentre Claude Code è in esecuzione.',
    nl: 'Gebruik dit commando als je statusLine in Claude Code (settings.json). De gegevens verversen alleen terwijl Claude Code draait.',
    pl: 'Użyj tego polecenia jako statusLine w Claude Code (settings.json). Dane odświeżają się tylko, gdy Claude Code działa.',
    ru: 'Используйте эту команду как statusLine в Claude Code (settings.json). Данные обновляются только пока Claude Code запущен.',
    uk: 'Використовуйте цю команду як statusLine у Claude Code (settings.json). Дані оновлюються лише поки Claude Code запущено.',
    cs: 'Použijte tento příkaz jako statusLine v Claude Code (settings.json). Data se obnovují jen, když Claude Code běží.',
    sk: 'Použite tento príkaz ako statusLine v Claude Code (settings.json). Dáta sa obnovujú len, kým Claude Code beží.',
    ro: 'Folosește această comandă ca statusLine în Claude Code (settings.json). Datele se actualizează doar cât timp Claude Code rulează.',
    hu: 'Használd ezt a parancsot statusLine-ként a Claude Code-ban (settings.json). Az adatok csak addig frissülnek, amíg a Claude Code fut.',
    el: 'Χρησιμοποίησε αυτή την εντολή ως statusLine στο Claude Code (settings.json). Τα δεδομένα ενημερώνονται μόνο όσο τρέχει το Claude Code.',
    sv: 'Använd detta kommando som din statusLine i Claude Code (settings.json). Data uppdateras bara medan Claude Code körs.',
    da: 'Brug denne kommando som din statusLine i Claude Code (settings.json). Data opdateres kun, mens Claude Code kører.',
    fi: 'Käytä tätä komentoa statusLine-asetuksena Claude Codessa (settings.json). Tiedot päivittyvät vain, kun Claude Code on käynnissä.',
    nb: 'Bruk denne kommandoen som statusLine i Claude Code (settings.json). Data oppdateres bare mens Claude Code kjører.',
    tr: 'Bu komutu Claude Code’da statusLine olarak kullanın (settings.json). Veriler yalnızca Claude Code çalışırken güncellenir.',
    ca: 'Fes servir aquesta ordre com a statusLine al Claude Code (settings.json). Les dades només s’actualitzen mentre el Claude Code s’executa.',
    bg: 'Използвайте тази команда като statusLine в Claude Code (settings.json). Данните се обновяват само докато Claude Code работи.',
    hr: 'Koristi ovu naredbu kao statusLine u Claude Codeu (settings.json). Podaci se osvježavaju samo dok Claude Code radi.',
    sr: 'Користи ову команду као statusLine у Claude Code-у (settings.json). Подаци се освежавају само док Claude Code ради.',
    lt: 'Naudokite šią komandą kaip statusLine Claude Code programoje (settings.json). Duomenys atsinaujina tik kol Claude Code veikia.',
    ja: 'このコマンドを Claude Code の statusLine に設定してください（settings.json）。データは Claude Code の実行中のみ更新されます。',
    ko: '이 명령을 Claude Code의 statusLine으로 설정하세요(settings.json). 데이터는 Claude Code가 실행 중일 때만 갱신됩니다.',
    zh: '将此命令设置为 Claude Code 的 statusLine（settings.json）。数据仅在 Claude Code 运行时刷新。',
    vi: 'Dùng lệnh này làm statusLine trong Claude Code (settings.json). Dữ liệu chỉ cập nhật khi Claude Code đang chạy.',
    th: 'ใช้คำสั่งนี้เป็น statusLine ใน Claude Code (settings.json) ข้อมูลจะรีเฟรชเฉพาะตอนที่ Claude Code กำลังทำงาน',
    id: 'Gunakan perintah ini sebagai statusLine di Claude Code (settings.json). Data hanya diperbarui saat Claude Code berjalan.',
    ms: 'Gunakan arahan ini sebagai statusLine dalam Claude Code (settings.json). Data hanya dikemas kini semasa Claude Code berjalan.',
    fil: 'Gamitin ang command na ito bilang statusLine sa Claude Code (settings.json). Nagre-refresh lang ang data habang tumatakbo ang Claude Code.',
    hi: 'इस कमांड को Claude Code में अपने statusLine के रूप में उपयोग करें (settings.json)। डेटा केवल तभी ताज़ा होता है जब Claude Code चल रहा हो।',
    ar: 'استخدم هذا الأمر كـ statusLine في Claude Code ‏(settings.json). تتحدّث البيانات فقط أثناء تشغيل Claude Code.',
    he: 'השתמשו בפקודה זו כ-statusLine ב-Claude Code ‏(settings.json). הנתונים מתעדכנים רק כאשר Claude Code פועל.',
    fa: 'این فرمان را به عنوان statusLine در Claude Code استفاده کنید (settings.json). داده‌ها فقط هنگام اجرای Claude Code تازه می‌شوند.',
  };
  for (const k in SOURCE_HINT) if (DICT[k]) DICT[k].source_hint = SOURCE_HINT[k];

  // The two entries of the data source dropdown. This is the one control that
  // decides between the Terms-safe default and the endpoint people get banned
  // for, so "(default)" has to reach a non-English reader — it was hardcoded
  // English. en/pt; other locales fall back to English via t().
  const SOURCE_OPT = {
    source_opt_statusline: { en: 'Claude Code statusLine (default)', pt: 'statusLine do Claude Code (padrão)' },
    source_opt_endpoint:   { en: 'Anthropic endpoint',               pt: 'Endpoint da Anthropic' },
  };
  for (const key in SOURCE_OPT) for (const k in SOURCE_OPT[key]) if (DICT[k]) DICT[k][key] = SOURCE_OPT[key][k];


  // ---- v1.3.0 keys (grouped pane, pace hint, honest notes) ----
  // tooltip on the API-value row (subscription accounts)
  const EQUIV_COST_HINT = {
    en: "what today’s usage would cost at API prices — covered by your subscription, not billed separately",
    es: "lo que costaría el uso de hoy a precios de API — cubierto por tu suscripción, no se factura aparte",
    pt: "o que o uso de hoje custaria a preços de API — coberto pela sua assinatura, sem cobrança separada",
    fr: "ce que l'usage d'aujourd'hui coûterait au tarif API — couvert par votre abonnement, sans facturation séparée",
    de: "was die heutige Nutzung zu API-Preisen kosten würde — durch Ihr Abo abgedeckt, nicht separat abgerechnet",
    it: "quanto costerebbe l'uso di oggi a prezzi API — coperto dal tuo abbonamento, senza addebito separato",
    nl: "wat het gebruik van vandaag tegen API-prijzen zou kosten — gedekt door je abonnement, niet apart gefactureerd",
    pl: "ile dzisiejsze zużycie kosztowałoby po cenach API — pokryte subskrypcją, bez osobnego rozliczenia",
    ru: "сколько сегодняшнее использование стоило бы по ценам API — покрывается вашей подпиской, отдельно не оплачивается",
    uk: "скільки сьогоднішнє використання коштувало б за цінами API — покривається вашою підпискою, окремо не оплачується",
    cs: "kolik by dnešní využití stálo v cenách API — kryto předplatným, neúčtuje se zvlášť",
    sk: "koľko by dnešné využitie stálo v cenách API — kryté predplatným, neúčtuje sa zvlášť",
    ro: "cât ar costa utilizarea de azi la prețuri API — acoperit de abonamentul tău, fără facturare separată",
    hu: "mennyibe kerülne a mai használat API-árakon — az előfizetésed fedezi, nem számlázzák külön",
    el: "τι θα κόστιζε η σημερινή χρήση σε τιμές API — καλύπτεται από τη συνδρομή σου, δεν χρεώνεται ξεχωριστά",
    sv: "vad dagens användning skulle kosta till API-priser — täcks av din prenumeration, faktureras inte separat",
    da: "hvad dagens forbrug ville koste til API-priser — dækket af dit abonnement, faktureres ikke separat",
    fi: "mitä tämän päivän käyttö maksaisi API-hinnoilla — kuuluu tilaukseesi, ei laskuteta erikseen",
    nb: "hva dagens bruk ville kostet til API-priser — dekkes av abonnementet ditt, faktureres ikke separat",
    tr: "bugünkü kullanımın API fiyatlarıyla maliyeti — aboneliğinize dahil, ayrıca faturalandırılmaz",
    ca: "el que costaria l'ús d'avui a preus d'API — cobert per la teva subscripció, sense facturació a part",
    bg: "колко би струвало днешното използване по цените на API — покрито от абонамента ви, не се таксува отделно",
    hr: "koliko bi današnja potrošnja koštala po API cijenama — pokriveno tvojom pretplatom, ne naplaćuje se posebno",
    sr: "колико би данашња потрошња коштала по API ценама — покривено твојом претплатом, не наплаћује се посебно",
    lt: "kiek šiandienos naudojimas kainuotų API kainomis — tai dengia jūsų prenumerata, atskirai neapmokestinama",
    ja: "今日の使用量をAPI価格で換算した金額です。サブスクリプションに含まれるため、別途請求はされません。",
    ko: "오늘 사용량을 API 가격으로 환산한 금액입니다. 구독에 포함되어 있어 별도로 청구되지 않습니다.", zh: "今日用量按 API 价格折算的费用——已包含在你的订阅中，不会另行计费。",
    vi: "Chi phí của mức dùng hôm nay nếu tính theo giá API — đã bao gồm trong gói đăng ký, không bị tính phí riêng.",
    th: "มูลค่าการใช้งานวันนี้หากคิดตามราคา API — รวมอยู่ในแผนสมาชิกของคุณแล้ว ไม่เรียกเก็บแยก",
    id: "biaya pemakaian hari ini jika dihitung dengan harga API — sudah dicakup langganan Anda, tidak ditagih terpisah",
    ms: "kos penggunaan hari ini jika dikira pada harga API — sudah ditanggung oleh langganan anda, tidak dicaj berasingan",
    fil: "kung magkano sana ang paggamit ngayong araw sa presyo ng API — sakop na ng subscription mo, hindi na sinisingil nang hiwalay",
    hi: "आज के उपयोग की API कीमतों पर अनुमानित लागत — आपकी सदस्यता में शामिल, अलग से बिल नहीं होगी।",
    ar: "ما كان سيكلّفه استخدام اليوم بأسعار API — يغطيه اشتراكك ولا يُفوتَر بشكل منفصل",
    he: "כמה השימוש של היום היה עולה במחירי API — מכוסה במנוי שלך ולא מחויב בנפרד",
    fa: "هزینه مصرف امروز اگر به قیمت API محاسبه می‌شد — تحت پوشش اشتراک شماست و جداگانه صورتحساب نمی‌شود",
  };
  for (const k in EQUIV_COST_HINT) if (DICT[k]) DICT[k].equiv_cost_hint = EQUIV_COST_HINT[k];

  // same tooltip for API-key/Console accounts (no "covered by your plan" claim — they ARE billed)
  const EQUIV_COST_HINT_API = {
    en: "what today’s usage would cost at API prices", es: "lo que costaría el uso de hoy a precios de API",
    pt: "o que o uso de hoje custaria a preços de API",
    fr: "ce que l'usage d'aujourd'hui coûterait au tarif API",
    de: "was die heutige Nutzung zu API-Preisen kosten würde",
    it: "quanto costerebbe l'uso di oggi a prezzi API",
    nl: "wat het gebruik van vandaag tegen API-prijzen zou kosten",
    pl: "ile dzisiejsze zużycie kosztowałoby po cenach API",
    ru: "сколько сегодняшнее использование стоило бы по ценам API",
    uk: "скільки сьогоднішнє використання коштувало б за цінами API",
    cs: "kolik by dnešní využití stálo v cenách API", sk: "koľko by dnešné využitie stálo v cenách API",
    ro: "cât ar costa utilizarea de azi la prețuri API", hu: "mennyibe kerülne a mai használat API-árakon",
    el: "τι θα κόστιζε η σημερινή χρήση σε τιμές API",
    sv: "vad dagens användning skulle kosta till API-priser",
    da: "hvad dagens forbrug ville koste til API-priser",
    fi: "mitä tämän päivän käyttö maksaisi API-hinnoilla", nb: "hva dagens bruk ville kostet til API-priser",
    tr: "bugünkü kullanımın API fiyatlarıyla maliyeti", ca: "el que costaria l'ús d'avui a preus d'API",
    bg: "колко би струвало днешното използване по цените на API",
    hr: "koliko bi današnja potrošnja koštala po API cijenama",
    sr: "колико би данашња потрошња коштала по API ценама",
    lt: "kiek šiandienos naudojimas kainuotų API kainomis", ja: "今日の使用量をAPI価格で換算した金額です。",
    ko: "오늘 사용량을 API 가격으로 환산한 금액입니다.", zh: "今日用量按 API 价格折算的费用。",
    vi: "Chi phí của mức dùng hôm nay nếu tính theo giá API.", th: "มูลค่าการใช้งานวันนี้หากคิดตามราคา API",
    id: "biaya pemakaian hari ini jika dihitung dengan harga API",
    ms: "kos penggunaan hari ini jika dikira pada harga API",
    fil: "kung magkano sana ang paggamit ngayong araw sa presyo ng API",
    hi: "आज के उपयोग की API कीमतों पर अनुमानित लागत।", ar: "ما كان سيكلّفه استخدام اليوم بأسعار API",
    he: "כמה השימוש של היום היה עולה במחירי API", fa: "هزینه مصرف امروز اگر به قیمت API محاسبه می‌شد",
  };
  for (const k in EQUIV_COST_HINT_API) if (DICT[k]) DICT[k].equiv_cost_hint_api = EQUIV_COST_HINT_API[k];

  // per-model split header (share of today’s cost)
  const BY_MODEL = {
    en: "by model", es: "por modelo", pt: "por modelo", fr: "par modèle", de: "nach Modell",
    it: "per modello", nl: "per model", pl: "wg modelu", ru: "по моделям", uk: "за моделями",
    cs: "podle modelu", sk: "podľa modelu", ro: "per model", hu: "modellenként", el: "ανά μοντέλο",
    sv: "per modell", da: "pr. model", fi: "malleittain", nb: "per modell", tr: "modele göre",
    ca: "per model", bg: "по модел", hr: "po modelu", sr: "по моделу", lt: "pagal modelį", ja: "モデル別",
    ko: "모델별", zh: "按模型", vi: "theo mô hình", th: "ตามโมเดล", id: "per model", ms: "mengikut model",
    fil: "bawat model", hi: "मॉडल अनुसार", ar: "حسب النموذج", he: "לפי מודל", fa: "به تفکیک مدل",
  };
  for (const k in BY_MODEL) if (DICT[k]) DICT[k].by_model = BY_MODEL[k];

  // per-project split header (top projects today)
  const BY_PROJECT = {
    en: "by project", es: "por proyecto", pt: "por projeto", fr: "par projet", de: "nach Projekt",
    it: "per progetto", nl: "per project", pl: "wg projektu", ru: "по проектам", uk: "за проєктами",
    cs: "podle projektu", sk: "podľa projektu", ro: "per proiect", hu: "projektenként", el: "ανά έργο",
    sv: "per projekt", da: "pr. projekt", fi: "projekteittain", nb: "per prosjekt", tr: "projeye göre",
    ca: "per projecte", bg: "по проект", hr: "po projektu", sr: "по пројекту", lt: "pagal projektą",
    ja: "プロジェクト別", ko: "프로젝트별", zh: "按项目", vi: "theo dự án", th: "ตามโปรเจกต์", id: "per proyek",
    ms: "mengikut projek", fil: "bawat proyekto", hi: "प्रोजेक्ट अनुसार", ar: "حسب المشروع", he: "לפי פרויקט",
    fa: "به تفکیک پروژه",
  };
  for (const k in BY_PROJECT) if (DICT[k]) DICT[k].by_project = BY_PROJECT[k];

  // token-counts group header
  const TOKENS_TITLE = {
    en: "tokens", es: "tokens", pt: "tokens", fr: "jetons", de: "Tokens", it: "token", nl: "tokens",
    pl: "tokeny", ru: "токены", uk: "токени", cs: "tokeny", sk: "tokeny", ro: "tokenuri", hu: "tokenek",
    el: "tokens", sv: "tokens", da: "tokens", fi: "tokenit", nb: "tokens", tr: "jetonlar", ca: "tokens",
    bg: "токени", hr: "tokeni", sr: "токени", lt: "žetonai", ja: "トークン", ko: "토큰", zh: "令牌", vi: "token",
    th: "โทเค็น", id: "token", ms: "token", fil: "mga token", hi: "टोकन", ar: "الرموز", he: "טוקנים",
    fa: "توکن‌ها",
  };
  for (const k in TOKENS_TITLE) if (DICT[k]) DICT[k].tokens_title = TOKENS_TITLE[k];

  // generic total row label
  const TOTAL_LABEL = {
    en: "total", es: "total", pt: "total", fr: "total", de: "gesamt", it: "totale", nl: "totaal", pl: "razem",
    ru: "итого", uk: "разом", cs: "celkem", sk: "spolu", ro: "total", hu: "összesen", el: "σύνολο",
    sv: "totalt", da: "i alt", fi: "yhteensä", nb: "totalt", tr: "toplam", ca: "total", bg: "общо",
    hr: "ukupno", sr: "укупно", lt: "iš viso", ja: "合計", ko: "합계", zh: "总计", vi: "tổng", th: "รวม",
    id: "total", ms: "jumlah", fil: "kabuuan", hi: "कुल", ar: "الإجمالي", he: "סה״כ", fa: "مجموع",
  };
  for (const k in TOTAL_LABEL) if (DICT[k]) DICT[k].total_label = TOTAL_LABEL[k];

  // the local 7-day window EXCLUDES today — the header must say so (overrides the older "last 7 days")
  const LAST7_V2 = {
    en: "previous 7 days", es: "7 días anteriores", pt: "7 dias anteriores", fr: "7 jours précédents",
    de: "vorherige 7 Tage", it: "7 giorni precedenti", nl: "vorige 7 dagen", pl: "poprzednie 7 dni",
    ru: "предыдущие 7 дней", uk: "попередні 7 днів", cs: "předchozích 7 dní", sk: "predchádzajúcich 7 dní",
    ro: "7 zile anterioare", hu: "előző 7 nap", el: "προηγούμενες 7 ημέρες", sv: "föregående 7 dagar",
    da: "forrige 7 dage", fi: "edelliset 7 päivää", nb: "forrige 7 dager", tr: "önceki 7 gün",
    ca: "7 dies anteriors", bg: "предходните 7 дни", hr: "prethodnih 7 dana", sr: "претходних 7 дана",
    lt: "ankstesnės 7 dienos", ja: "前の7日間", ko: "이전 7일", zh: "之前 7 天", vi: "7 ngày trước đó",
    th: "7 วันก่อนหน้า", id: "7 hari sebelumnya", ms: "7 hari sebelumnya", fil: "naunang 7 araw",
    hi: "पहले के 7 दिन", ar: "الأيام الـ7 السابقة", he: "7 הימים הקודמים", fa: "۷ روز پیشین",
  };
  for (const k in LAST7_V2) if (DICT[k]) DICT[k].last_7d = LAST7_V2[k];

  // tooltip stating the savings baseline — the figure is NET (reads save, write premiums cost)
  const CACHE_SAVINGS_HINT = {
    en: "net effect of caching vs paying full input price: reads save money, cache writes cost a premium — already reflected in the total",
    es: "efecto neto de la caché frente a pagar el precio completo de entrada: las lecturas ahorran dinero, las escrituras en caché tienen un recargo — ya reflejado en el total",
    pt: "efeito líquido do cache em vez de pagar o preço cheio de entrada: leituras economizam dinheiro, escritas em cache custam um adicional — já refletido no total",
    fr: "effet net du cache par rapport au plein tarif d'entrée : les lectures font économiser, les écritures en cache coûtent un supplément — déjà pris en compte dans le total",
    de: "Nettoeffekt des Cachings gegenüber dem vollen Eingabepreis: Lesevorgänge sparen Geld, Cache-Schreibvorgänge kosten einen Aufpreis — bereits im Gesamtbetrag enthalten",
    it: "effetto netto della cache rispetto al prezzo pieno di input: le letture fanno risparmiare, le scritture in cache costano un sovrapprezzo — già incluso nel totale",
    nl: "netto-effect van caching versus de volledige invoerprijs: lezen bespaart geld, schrijven naar de cache kost extra — al verwerkt in het totaal",
    pl: "efekt netto cache'owania względem pełnej ceny wejścia: odczyty oszczędzają pieniądze, zapisy do cache kosztują dodatkowo — już uwzględnione w sumie",
    ru: "чистый эффект кэширования по сравнению с полной ценой ввода: чтения экономят деньги, записи в кэш обходятся с наценкой — уже учтено в итоге",
    uk: "чистий ефект кешування порівняно з повною ціною вводу: читання економлять гроші, записи в кеш обходяться з надбавкою — вже враховано в підсумку",
    cs: "čistý efekt cache oproti plné ceně vstupu: čtení šetří peníze, zápisy do cache stojí příplatek — již zahrnuto v součtu",
    sk: "čistý efekt cache oproti plnej cene vstupu: čítanie šetrí peniaze, zápisy do cache stoja príplatok — už zahrnuté v súčte",
    ro: "efectul net al cache-ului față de plata prețului întreg de intrare: citirile economisesc bani, scrierile în cache costă un supliment — deja inclus în total",
    hu: "a gyorsítótárazás nettó hatása a teljes bemeneti árhoz képest: az olvasás pénzt spórol, a gyorsítótár-írás felárba kerül — az összeg már tartalmazza",
    el: "καθαρό αποτέλεσμα του caching έναντι της πλήρους τιμής εισόδου: οι αναγνώσεις εξοικονομούν χρήματα, οι εγγραφές cache κοστίζουν επιπλέον — ήδη συνυπολογισμένο στο σύνολο",
    sv: "nettoeffekten av cachning jämfört med fullt indatapris: läsningar sparar pengar, cacheskrivningar kostar extra — redan inräknat i totalsumman",
    da: "nettoeffekten af caching i forhold til fuld inputpris: læsninger sparer penge, cacheskrivninger koster ekstra — allerede medregnet i totalen",
    fi: "välimuistin nettovaikutus verrattuna täyteen syötehintaan: lukeminen säästää rahaa, välimuistiin kirjoittaminen maksaa lisähintaa — sisältyy jo kokonaissummaan",
    nb: "nettoeffekten av caching sammenlignet med full inndatapris: lesinger sparer penger, cache-skrivinger koster ekstra — allerede medregnet i totalen",
    tr: "önbelleklemenin tam giriş fiyatına kıyasla net etkisi: okumalar tasarruf sağlar, önbelleğe yazmalar ek ücret getirir — toplama zaten dahil",
    ca: "efecte net de la memòria cau respecte a pagar el preu complet d'entrada: les lectures estalvien diners, les escriptures a la memòria cau tenen un sobrecost — ja reflectit al total",
    bg: "нетен ефект от кеширането спрямо пълната цена на входа: четенията пестят пари, записите в кеша струват с надценка — вече отразено в общата сума",
    hr: "neto učinak cachea u odnosu na punu cijenu ulaza: čitanja štede novac, upisi u cache koštaju više — već uključeno u ukupni iznos",
    sr: "нето ефекат кеширања у односу на пуну цену улаза: читања штеде новац, уписи у кеш коштају више — већ укључено у укупан износ",
    lt: "grynasis talpyklos efektas, palyginti su visa įvesties kaina: skaitymai taupo pinigus, įrašymai į talpyklą kainuoja brangiau — jau įskaičiuota į bendrą sumą",
    ja: "通常の入力価格で支払う場合と比べたキャッシュの正味の効果です。読み取りは節約になり、キャッシュ書き込みには割増コストがかかります。合計にはすでに反映されています。",
    ko: "정가 입력 가격을 지불하는 경우와 비교한 캐시의 순효과입니다. 읽기는 비용을 절약하고 캐시 쓰기는 할증 비용이 듭니다. 합계에 이미 반영되어 있습니다.",
    zh: "缓存相对于按完整输入价格付费的净效果：读取省钱，缓存写入则需支付溢价——已体现在总计中。",
    vi: "hiệu quả ròng của cache so với việc trả giá đầu vào đầy đủ: đọc cache giúp tiết kiệm, ghi cache chịu thêm phụ phí — đã được phản ánh trong tổng",
    th: "ผลสุทธิของการใช้แคชเทียบกับการจ่ายราคาอินพุตเต็มจำนวน: การอ่านช่วยประหยัด ส่วนการเขียนแคชมีค่าใช้จ่ายเพิ่ม — สะท้อนอยู่ในยอดรวมแล้ว",
    id: "efek bersih caching dibandingkan membayar harga input penuh: pembacaan cache menghemat biaya, penulisan cache dikenai biaya tambahan — sudah tercermin dalam total",
    ms: "kesan bersih caching berbanding membayar harga input penuh: bacaan cache menjimatkan kos, penulisan cache dikenakan caj tambahan — sudah diambil kira dalam jumlah",
    fil: "netong epekto ng caching kumpara sa pagbabayad ng buong presyo ng input: nakakatipid ang mga cache read, may dagdag na bayad ang mga cache write — kasama na sa kabuuan",
    hi: "पूर्ण इनपुट कीमत चुकाने की तुलना में कैशिंग का शुद्ध प्रभाव: कैश रीड से पैसे बचते हैं, कैश राइट पर अतिरिक्त लागत लगती है — कुल में पहले से शामिल।",
    ar: "الأثر الصافي للتخزين المؤقت مقارنةً بدفع سعر الإدخال الكامل: القراءات توفّر المال بينما تكلّف الكتابة في الذاكرة المؤقتة علاوة — محتسب بالفعل في الإجمالي",
    he: "ההשפעה נטו של המטמון לעומת תשלום מחיר קלט מלא: קריאות חוסכות כסף, כתיבות למטמון כרוכות בתוספת מחיר — כבר כלול בסה״כ",
    fa: "اثر خالص کش در مقایسه با پرداخت قیمت کامل ورودی: خواندن‌ها پول صرفه‌جویی می‌کنند، نوشتن در کش هزینه اضافه دارد — از قبل در مجموع لحاظ شده",
  };
  for (const k in CACHE_SAVINGS_HINT) if (DICT[k]) DICT[k].cache_savings_hint = CACHE_SAVINGS_HINT[k];

  // first-run empty state for the token pane
  const NO_DATA = {
    en: "no Claude Code activity found yet", es: "aún sin actividad de Claude Code",
    pt: "ainda sem atividade do Claude Code", fr: "aucune activité Claude Code pour l'instant",
    de: "noch keine Claude-Code-Aktivität gefunden", it: "ancora nessuna attività di Claude Code",
    nl: "nog geen Claude Code-activiteit gevonden", pl: "nie znaleziono jeszcze aktywności Claude Code",
    ru: "активность Claude Code пока не найдена", uk: "активності Claude Code поки не знайдено",
    cs: "zatím žádná aktivita Claude Code", sk: "zatiaľ žiadna aktivita Claude Code",
    ro: "încă nicio activitate Claude Code", hu: "még nincs Claude Code-aktivitás",
    el: "δεν βρέθηκε ακόμη δραστηριότητα Claude Code", sv: "ingen Claude Code-aktivitet hittad ännu",
    da: "ingen Claude Code-aktivitet fundet endnu", fi: "Claude Code -toimintaa ei vielä löytynyt",
    nb: "ingen Claude Code-aktivitet funnet ennå", tr: "henüz Claude Code etkinliği bulunamadı",
    ca: "encara no hi ha activitat de Claude Code", bg: "все още няма активност на Claude Code",
    hr: "još nema aktivnosti Claude Codea", sr: "још нема активности Claude Code-а",
    lt: "Claude Code veiklos kol kas nerasta", ja: "まだ Claude Code のアクティビティがありません",
    ko: "아직 Claude Code 활동이 없습니다", zh: "尚未发现 Claude Code 活动", vi: "chưa thấy hoạt động Claude Code nào",
    th: "ยังไม่พบการใช้งาน Claude Code", id: "belum ada aktivitas Claude Code yang ditemukan",
    ms: "belum ada aktiviti Claude Code dijumpai", fil: "wala pang nakitang aktibidad ng Claude Code",
    hi: "अभी तक कोई Claude Code गतिविधि नहीं मिली", ar: "لم يُعثر على أي نشاط لـ Claude Code بعد",
    he: "עדיין לא נמצאה פעילות Claude Code", fa: "هنوز فعالیتی از Claude Code یافت نشده",
  };
  for (const k in NO_DATA) if (DICT[k]) DICT[k].no_data = NO_DATA[k];

  // tooltip on the burn-rate hint next to the 5h countdown
  const PACE_HINT = {
    en: "estimated pace — highlighted when the limit would be reached before the reset",
    es: "ritmo estimado — se resalta cuando el límite se alcanzaría antes del reinicio",
    pt: "ritmo estimado — destacado quando o limite seria atingido antes do reset",
    fr: "rythme estimé — mis en évidence quand la limite serait atteinte avant la réinitialisation",
    de: "geschätztes Tempo — hervorgehoben, wenn das Limit vor dem Reset erreicht würde",
    it: "ritmo stimato — evidenziato quando il limite verrebbe raggiunto prima del reset",
    nl: "geschat tempo — gemarkeerd wanneer de limiet vóór de reset bereikt zou worden",
    pl: "szacowane tempo — wyróżnione, gdy limit zostałby osiągnięty przed resetem",
    ru: "расчётный темп — подсвечивается, если лимит будет исчерпан до сброса",
    uk: "розрахунковий темп — підсвічується, якщо ліміт буде вичерпано до скидання",
    cs: "odhadované tempo — zvýrazněno, pokud by byl limit dosažen před resetem",
    sk: "odhadované tempo — zvýraznené, ak by sa limit dosiahol pred resetom",
    ro: "ritm estimat — evidențiat când limita ar fi atinsă înainte de resetare",
    hu: "becsült tempó — kiemelve, ha a limit még a visszaállítás előtt betelne",
    el: "εκτιμώμενος ρυθμός — επισημαίνεται όταν το όριο θα εξαντληθεί πριν από την επαναφορά",
    sv: "uppskattad takt — markeras när gränsen skulle nås före återställningen",
    da: "anslået tempo — fremhæves, når grænsen ville blive nået inden nulstillingen",
    fi: "arvioitu tahti — korostetaan, kun raja täyttyisi ennen nollausta",
    nb: "anslått tempo — utheves når grensen ville blitt nådd før nullstillingen",
    tr: "tahmini hız — limite sıfırlamadan önce ulaşılacaksa vurgulanır",
    ca: "ritme estimat — es ressalta quan el límit s'assoliria abans del reinici",
    bg: "прогнозно темпо — откроява се, когато лимитът би бил достигнат преди нулирането",
    hr: "procijenjeni tempo — istaknuto kad bi limit bio dosegnut prije reseta",
    sr: "процењени темпо — истакнуто кад би лимит био достигнут пре ресета",
    lt: "numatomas tempas — paryškinama, jei limitas būtų pasiektas iki atstatymo",
    ja: "推定ペースです。リセット前に上限へ達する見込みのときに強調表示されます。", ko: "예상 사용 속도입니다. 초기화 전에 한도에 도달할 것으로 보이면 강조 표시됩니다.",
    zh: "预计使用速度——若将在重置前达到限额则会高亮显示。",
    vi: "Tốc độ dùng ước tính — được tô nổi bật khi dự kiến chạm giới hạn trước lúc đặt lại.",
    th: "อัตราการใช้โดยประมาณ — จะถูกเน้นเมื่อคาดว่าจะถึงลิมิตก่อนการรีเซ็ต",
    id: "perkiraan laju pemakaian — disorot bila batas akan tercapai sebelum reset",
    ms: "anggaran kadar penggunaan — diserlahkan jika had akan dicapai sebelum set semula",
    fil: "tinatayang bilis ng paggamit — naka-highlight kapag maaabot ang limitasyon bago ang reset",
    hi: "अनुमानित गति — यदि रीसेट से पहले सीमा तक पहुँचने का अनुमान हो तो हाइलाइट होती है।",
    ar: "الوتيرة المقدّرة — تُبرَز عندما يُتوقّع بلوغ الحد قبل إعادة الضبط",
    he: "קצב משוער — מודגש כשצפוי להגיע למגבלה לפני האיפוס",
    fa: "سرعت تخمینی مصرف — وقتی حد پیش از بازنشانی پر شود برجسته می‌شود",
  };
  for (const k in PACE_HINT) if (DICT[k]) DICT[k].pace_hint = PACE_HINT[k];

  // second-click confirmation for update-and-restart
  const UPDATE_CONFIRM = {
    en: "click again to confirm", es: "pulsa otra vez para confirmar", pt: "clique de novo para confirmar",
    fr: "cliquez encore pour confirmer", de: "erneut klicken zum Bestätigen",
    it: "premi di nuovo per confermare", nl: "klik nogmaals om te bevestigen",
    pl: "kliknij ponownie, aby potwierdzić", ru: "нажмите ещё раз для подтверждения",
    uk: "натисніть ще раз для підтвердження", cs: "klikněte znovu pro potvrzení",
    sk: "kliknite znova na potvrdenie", ro: "apasă din nou pentru a confirma",
    hu: "kattints újra a megerősítéshez", el: "πάτησε ξανά για επιβεβαίωση",
    sv: "klicka igen för att bekräfta", da: "klik igen for at bekræfte", fi: "vahvista painamalla uudelleen",
    nb: "klikk igjen for å bekrefte", tr: "onaylamak için tekrar tıklayın",
    ca: "torna a prémer per confirmar", bg: "натиснете отново за потвърждение",
    hr: "klikni ponovno za potvrdu", sr: "кликни поново за потврду",
    lt: "spustelėkite dar kartą, kad patvirtintumėte", ja: "もう一度クリックで確定", ko: "한 번 더 클릭해 확인", zh: "再次点击确认",
    vi: "Nhấn lần nữa để xác nhận", th: "คลิกอีกครั้งเพื่อยืนยัน", id: "klik lagi untuk konfirmasi",
    ms: "klik lagi untuk mengesahkan", fil: "i-click muli para kumpirmahin",
    hi: "पुष्टि के लिए फिर क्लिक करें", ar: "انقر مرة أخرى للتأكيد", he: "לחצו שוב לאישור",
    fa: "برای تأیید دوباره کلیک کنید",
  };
  for (const k in UPDATE_CONFIRM) if (DICT[k]) DICT[k].update_confirm = UPDATE_CONFIRM[k];

  // scope-only footnote: pricing explanation moved to the tooltip on the value itself (overrides the old three-clause note)
  const COST_NOTE_V2 = {
    en: "Claude Code (CLI) only", es: "solo Claude Code (CLI)", pt: "só Claude Code (CLI)",
    fr: "Claude Code (CLI) uniquement", de: "nur Claude Code (CLI)", it: "solo Claude Code (CLI)",
    nl: "alleen Claude Code (CLI)", pl: "tylko Claude Code (CLI)", ru: "только Claude Code (CLI)",
    uk: "лише Claude Code (CLI)", cs: "jen Claude Code (CLI)", sk: "len Claude Code (CLI)",
    ro: "doar Claude Code (CLI)", hu: "csak Claude Code (CLI)", el: "μόνο Claude Code (CLI)",
    sv: "endast Claude Code (CLI)", da: "kun Claude Code (CLI)", fi: "vain Claude Code (CLI)",
    nb: "kun Claude Code (CLI)", tr: "yalnızca Claude Code (CLI)", ca: "només Claude Code (CLI)",
    bg: "само Claude Code (CLI)", hr: "samo Claude Code (CLI)", sr: "само Claude Code (CLI)",
    lt: "tik Claude Code (CLI)", ja: "Claude Code (CLI) のみ", ko: "Claude Code (CLI) 전용",
    zh: "仅 Claude Code (CLI)", vi: "chỉ Claude Code (CLI)", th: "เฉพาะ Claude Code (CLI)",
    id: "hanya Claude Code (CLI)", ms: "hanya Claude Code (CLI)", fil: "Claude Code (CLI) lang",
    hi: "केवल Claude Code (CLI)", ar: "Claude Code (CLI) فقط", he: "רק Claude Code (CLI)",
    fa: "فقط Claude Code (CLI)",
  };
  for (const k in COST_NOTE_V2) if (DICT[k]) DICT[k].cost_note = COST_NOTE_V2[k];

  // the settings-window ToS/credential disclaimer — the one paragraph where reading comprehension matters most, so it is translated like everything else
  const DISCLAIMER = {
    en: "Reads your local Claude credential to query an undocumented Anthropic endpoint; this may be against Anthropic’s Terms — use at your own risk. Not affiliated with or endorsed by Anthropic. Claude™ and Claude Code™ are trademarks of Anthropic, PBC.",
    es: "Lee tu credencial local de Claude para consultar un endpoint no documentado de Anthropic; esto puede ir contra los Términos de Anthropic — úsalo bajo tu propio riesgo. Sin afiliación ni respaldo de Anthropic. Claude™ y Claude Code™ son marcas comerciales de Anthropic, PBC.",
    pt: "Lê sua credencial local do Claude para consultar um endpoint não documentado da Anthropic; isso pode violar os Termos da Anthropic — use por sua conta e risco. Sem afiliação ou endosso da Anthropic. Claude™ e Claude Code™ são marcas registradas da Anthropic, PBC.",
    fr: "Lit vos identifiants Claude locaux pour interroger un point d'accès Anthropic non documenté ; cela peut enfreindre les conditions d'Anthropic — utilisez-le à vos risques et périls. Sans affiliation ni approbation d'Anthropic. Claude™ et Claude Code™ sont des marques d'Anthropic, PBC.",
    de: "Liest Ihre lokalen Claude-Anmeldedaten, um einen undokumentierten Anthropic-Endpunkt abzufragen; das kann gegen die Nutzungsbedingungen von Anthropic verstoßen — Nutzung auf eigenes Risiko. Nicht mit Anthropic verbunden oder von Anthropic unterstützt. Claude™ und Claude Code™ sind Marken von Anthropic, PBC.",
    it: "Legge la tua credenziale locale di Claude per interrogare un endpoint non documentato di Anthropic; ciò potrebbe violare i Termini di Anthropic — usalo a tuo rischio. Non affiliato né approvato da Anthropic. Claude™ e Claude Code™ sono marchi di Anthropic, PBC.",
    nl: "Leest je lokale Claude-inloggegevens om een niet-gedocumenteerd Anthropic-endpoint te bevragen; dit kan in strijd zijn met de voorwaarden van Anthropic — gebruik op eigen risico. Niet verbonden met of goedgekeurd door Anthropic. Claude™ en Claude Code™ zijn handelsmerken van Anthropic, PBC.",
    pl: "Odczytuje lokalne dane logowania Claude, aby odpytywać nieudokumentowany endpoint Anthropic; może to naruszać warunki Anthropic — używasz na własne ryzyko. Projekt niepowiązany z Anthropic i przez nią niezatwierdzony. Claude™ i Claude Code™ są znakami towarowymi Anthropic, PBC.",
    ru: "Считывает локальные учётные данные Claude, чтобы обращаться к недокументированному эндпоинту Anthropic; это может противоречить условиям Anthropic — используйте на свой страх и риск. Не связано с Anthropic и не одобрено ею. Claude™ и Claude Code™ — товарные знаки Anthropic, PBC.",
    uk: "Зчитує локальні облікові дані Claude, щоб звертатися до недокументованого ендпоінта Anthropic; це може суперечити умовам Anthropic — використовуйте на власний ризик. Не пов'язано з Anthropic і не схвалено нею. Claude™ і Claude Code™ — торговельні марки Anthropic, PBC.",
    cs: "Čte vaše místní přihlašovací údaje Claude a dotazuje se nedokumentovaného endpointu Anthropic; může to porušovat podmínky Anthropic — používejte na vlastní riziko. Není spojeno s Anthropic ani jí schváleno. Claude™ a Claude Code™ jsou ochranné známky Anthropic, PBC.",
    sk: "Číta vaše lokálne prihlasovacie údaje Claude a dopytuje sa nedokumentovaného endpointu Anthropic; môže to porušovať podmienky Anthropic — používajte na vlastné riziko. Nie je spojené s Anthropic ani ňou schválené. Claude™ a Claude Code™ sú ochranné známky Anthropic, PBC.",
    ro: "Citește credențialul local Claude pentru a interoga un endpoint Anthropic nedocumentat; acest lucru poate încălca Termenii Anthropic — folosește-l pe propriul risc. Fără afiliere sau aprobare din partea Anthropic. Claude™ și Claude Code™ sunt mărci comerciale ale Anthropic, PBC.",
    hu: "A helyi Claude-hitelesítő adataidat olvassa egy nem dokumentált Anthropic-végpont lekérdezéséhez; ez sértheti az Anthropic feltételeit — használd saját felelősségedre. Nem áll kapcsolatban az Anthropic céggel, és az nem hagyta jóvá. A Claude™ és a Claude Code™ az Anthropic, PBC védjegyei.",
    el: "Διαβάζει το τοπικό διαπιστευτήριο Claude για να στέλνει ερωτήματα σε ένα μη τεκμηριωμένο endpoint της Anthropic· αυτό ίσως αντιβαίνει στους Όρους της Anthropic — χρήση με δική σου ευθύνη. Δεν σχετίζεται με την Anthropic ούτε εγκρίνεται από αυτήν. Τα Claude™ και Claude Code™ είναι εμπορικά σήματα της Anthropic, PBC.",
    sv: "Läser dina lokala Claude-inloggningsuppgifter för att anropa en odokumenterad Anthropic-endpoint; detta kan strida mot Anthropics villkor — använd på egen risk. Inte knuten till eller godkänd av Anthropic. Claude™ och Claude Code™ är varumärken som tillhör Anthropic, PBC.",
    da: "Læser dine lokale Claude-loginoplysninger for at forespørge et udokumenteret Anthropic-endpoint; det kan være i strid med Anthropics vilkår — brug på eget ansvar. Ikke tilknyttet eller godkendt af Anthropic. Claude™ og Claude Code™ er varemærker tilhørende Anthropic, PBC.",
    fi: "Lukee paikalliset Claude-kirjautumistietosi ja tekee kyselyjä dokumentoimattomaan Anthropicin päätepisteeseen; tämä voi rikkoa Anthropicin käyttöehtoja — käytä omalla vastuullasi. Ei liity Anthropiciin eikä ole sen hyväksymä. Claude™ ja Claude Code™ ovat Anthropic, PBC:n tavaramerkkejä.",
    nb: "Leser din lokale Claude-pålogging for å spørre et udokumentert Anthropic-endepunkt; dette kan være i strid med Anthropics vilkår — bruk på eget ansvar. Ikke tilknyttet eller godkjent av Anthropic. Claude™ og Claude Code™ er varemerker som tilhører Anthropic, PBC.",
    tr: "Belgelenmemiş bir Anthropic uç noktasını sorgulamak için yerel Claude kimlik bilginizi okur; bu, Anthropic'in Koşullarına aykırı olabilir — kullanımı kendi sorumluluğunuzdadır. Anthropic ile bağlantılı değildir ve Anthropic tarafından onaylanmamıştır. Claude™ ve Claude Code™, Anthropic, PBC'nin ticari markalarıdır.",
    ca: "Llegeix la teva credencial local de Claude per consultar un endpoint no documentat d'Anthropic; això pot anar contra els Termes d'Anthropic — fes-lo servir sota la teva responsabilitat. Sense afiliació ni aval d'Anthropic. Claude™ i Claude Code™ són marques d'Anthropic, PBC.",
    bg: "Чете локалните ви данни за вход в Claude, за да запитва недокументиран ендпойнт на Anthropic; това може да противоречи на условията на Anthropic — използвайте на свой риск. Не е свързано с Anthropic и не е одобрено от нея. Claude™ и Claude Code™ са търговски марки на Anthropic, PBC.",
    hr: "Čita tvoje lokalne Claude vjerodajnice za upite prema nedokumentiranom Anthropicovom endpointu; to može biti protivno Anthropicovim uvjetima — koristi na vlastitu odgovornost. Nije povezano s Anthropicom niti ga Anthropic podržava. Claude™ i Claude Code™ zaštitni su znakovi tvrtke Anthropic, PBC.",
    sr: "Чита твоје локалне Claude акредитиве ради упита ка недокументованом Anthropic ендпоинту; то може бити противно условима Anthropic-а — користи на сопствену одговорност. Није повезано са Anthropic-ом нити га Anthropic подржава. Claude™ и Claude Code™ су заштитни знакови компаније Anthropic, PBC.",
    lt: "Nuskaito jūsų vietinius Claude prisijungimo duomenis, kad siųstų užklausas į nedokumentuotą Anthropic prieigos tašką; tai gali prieštarauti Anthropic sąlygoms — naudokite savo rizika. Nesusijęs su Anthropic ir jos nepatvirtintas. Claude™ ir Claude Code™ yra Anthropic, PBC prekių ženklai.",
    ja: "ローカルの Claude 認証情報を読み取り、非公開の Anthropic エンドポイントに問い合わせます。これは Anthropic の利用規約に反する可能性があります — 自己責任でご利用ください。Anthropic とは無関係であり、承認も受けていません。Claude™ および Claude Code™ は Anthropic, PBC の商標です。",
    ko: "로컬 Claude 자격 증명을 읽어 문서화되지 않은 Anthropic 엔드포인트를 조회합니다. 이는 Anthropic 약관에 어긋날 수 있으니 자신의 책임하에 사용하세요. Anthropic과 무관하며 Anthropic의 승인을 받지 않았습니다. Claude™ 및 Claude Code™는 Anthropic, PBC의 상표입니다.",
    zh: "读取本地的 Claude 凭据以查询未公开的 Anthropic 接口；这可能违反 Anthropic 的服务条款——使用风险自负。与 Anthropic 无关联，亦未获其认可。Claude™ 和 Claude Code™ 是 Anthropic, PBC 的商标。",
    vi: "Đọc thông tin đăng nhập Claude cục bộ để truy vấn một endpoint không công bố của Anthropic; điều này có thể trái với Điều khoản của Anthropic — bạn tự chịu rủi ro khi dùng. Không liên kết và không được Anthropic chứng thực. Claude™ và Claude Code™ là thương hiệu của Anthropic, PBC.",
    th: "อ่านข้อมูลรับรอง Claude ในเครื่องเพื่อสอบถามจุดเชื่อมต่อของ Anthropic ที่ไม่มีเอกสารรองรับ ซึ่งอาจขัดกับข้อกำหนดของ Anthropic — ใช้โดยรับความเสี่ยงเอง ไม่มีส่วนเกี่ยวข้องหรือได้รับการรับรองจาก Anthropic Claude™ และ Claude Code™ เป็นเครื่องหมายการค้าของ Anthropic, PBC",
    id: "Membaca kredensial Claude lokal Anda untuk mengakses endpoint Anthropic yang tidak terdokumentasi; ini mungkin melanggar Ketentuan Anthropic — gunakan dengan risiko sendiri. Tidak berafiliasi dengan atau didukung oleh Anthropic. Claude™ dan Claude Code™ adalah merek dagang Anthropic, PBC.",
    ms: "Membaca kelayakan Claude setempat anda untuk menanyakan endpoint Anthropic yang tidak didokumenkan; ini mungkin melanggar Terma Anthropic — gunakan atas risiko sendiri. Tiada kaitan dengan Anthropic dan tidak disahkan olehnya. Claude™ dan Claude Code™ ialah tanda dagangan Anthropic, PBC.",
    fil: "Binabasa nito ang lokal na Claude credential mo para mag-query sa isang undocumented na endpoint ng Anthropic; maaaring labag ito sa Terms ng Anthropic — gamitin sa sariling pananagutan. Hindi kaanib o inendorso ng Anthropic. Ang Claude™ at Claude Code™ ay mga trademark ng Anthropic, PBC.",
    hi: "यह आपके लोकल Claude क्रेडेंशियल को पढ़कर Anthropic के एक अप्रलेखित एंडपॉइंट से जानकारी लेता है; यह Anthropic की शर्तों के विरुद्ध हो सकता है — अपने जोखिम पर उपयोग करें। Anthropic से संबद्ध नहीं और न ही उसके द्वारा समर्थित। Claude™ और Claude Code™ Anthropic, PBC के ट्रेडमार्क हैं।",
    ar: "يقرأ بيانات اعتماد Claude المحلية لديك للاستعلام من مسار غير موثّق لدى Anthropic؛ قد يخالف ذلك شروط Anthropic — استخدمه على مسؤوليتك الخاصة. غير تابع لشركة Anthropic ولا معتمد منها. Claude™ وClaude Code™ علامتان تجاريتان لشركة Anthropic, PBC.",
    he: "קורא את פרטי הגישה המקומיים של Claude כדי לתשאל נקודת קצה לא מתועדת של Anthropic; ייתכן שהדבר מנוגד לתנאים של Anthropic — השימוש באחריותכם בלבד. אינו קשור ל-Anthropic ואינו מאושר על ידה. Claude™ ו-Claude Code™ הם סימנים מסחריים של Anthropic, PBC.",
    fa: "اعتبارنامه محلی Claude شما را می‌خواند تا از یک نقطه پایانی مستندنشده Anthropic پرس‌وجو کند؛ این کار ممکن است خلاف شرایط Anthropic باشد — با مسئولیت خودتان استفاده کنید. وابسته به Anthropic نیست و تأیید آن را ندارد. Claude™ و Claude Code™ علامت‌های تجاری Anthropic, PBC هستند.",
  };
  for (const k in DISCLAIMER) if (DICT[k]) DICT[k].disclaimer_text = DISCLAIMER[k];

  // the divisor is now the count of ACTIVE days, so the hard "(7d)" qualifier goes
  const AVG7_V2 = {
    en: "avg / day", es: "media/día", pt: "média/dia", fr: "moy./jour", de: "Ø/Tag", it: "media/giorno",
    nl: "gem./dag", pl: "śr./dzień", ru: "сред./день", uk: "серед./день", cs: "prům./den", sk: "priem./deň",
    ro: "medie/zi", hu: "átlag/nap", el: "μ.ό./ημέρα", sv: "snitt/dag", da: "gns./dag", fi: "ka./päivä",
    nb: "snitt/dag", tr: "ort./gün", ca: "mitjana/dia", bg: "ср./ден", hr: "pros./dan", sr: "прос./дан",
    lt: "vid./dienai", ja: "日平均", ko: "일평균", zh: "日均", vi: "TB/ngày", th: "เฉลี่ย/วัน", id: "rata-rata/hari",
    ms: "purata/hari", fil: "avg/araw", hi: "औसत/दिन", ar: "متوسط/يوم", he: "ממוצע/יום", fa: "میانگین/روز",
  };
  for (const k in AVG7_V2) if (DICT[k]) DICT[k].avg_7d = AVG7_V2[k];

  // the statusLine source cannot show paid extra usage or per-model limits — say so where the source is chosen
  const SOURCE_SCOPE_NOTE = {
    en: "this source has no paid extra-usage or per-model limit data — those need the Anthropic endpoint",
    es: "esta fuente no tiene datos de uso extra de pago ni de límites por modelo — para eso hace falta el endpoint de Anthropic",
    pt: "esta fonte não tem dados de uso extra pago nem de limites por modelo — para isso é preciso o endpoint da Anthropic",
    fr: "cette source ne fournit ni l'usage extra payant ni les limites par modèle — ces données nécessitent le point d'accès Anthropic",
    de: "diese Quelle hat keine Daten zu bezahlter Zusatznutzung oder Limits pro Modell — dafür ist der Anthropic-Endpunkt nötig",
    it: "questa fonte non ha dati sull'uso extra a pagamento né sui limiti per modello — per quelli serve l'endpoint di Anthropic",
    nl: "deze bron heeft geen gegevens over betaald extra gebruik of limieten per model — daarvoor is het Anthropic-endpoint nodig",
    pl: "to źródło nie ma danych o płatnej nadwyżce ani o limitach poszczególnych modeli — do tego potrzebny jest endpoint Anthropic",
    ru: "в этом источнике нет данных о платном дополнительном использовании и лимитах по моделям — для них нужен эндпоинт Anthropic",
    uk: "у цьому джерелі немає даних про платне додаткове використання та ліміти за моделями — для них потрібен ендпоінт Anthropic",
    cs: "tento zdroj nemá data o placeném využití navíc ani o limitech jednotlivých modelů — k tomu je potřeba endpoint Anthropic",
    sk: "tento zdroj nemá dáta o platenom využití navyše ani o limitoch jednotlivých modelov — na to je potrebný endpoint Anthropic",
    ro: "această sursă nu are date despre utilizarea extra plătită sau despre limitele per model — pentru acestea e nevoie de endpointul Anthropic",
    hu: "ez a forrás nem tartalmaz adatokat a fizetett extra használatról és a modellenkénti limitekről — ezekhez az Anthropic-végpont kell",
    el: "αυτή η πηγή δεν έχει δεδομένα για επιπλέον χρήση επί πληρωμή ή όρια ανά μοντέλο — γι' αυτά χρειάζεται το endpoint της Anthropic",
    sv: "den här källan saknar data om betald extraanvändning och gränser per modell — för det krävs Anthropic-endpointen",
    da: "denne kilde har ingen data om betalt ekstraforbrug eller grænser pr. model — det kræver Anthropic-endpointet",
    fi: "tässä lähteessä ei ole tietoja maksullisesta lisäkäytöstä eikä mallikohtaisista rajoista — niihin tarvitaan Anthropicin päätepiste",
    nb: "denne kilden har ingen data om betalt ekstrabruk eller grenser per modell — det krever Anthropic-endepunktet",
    tr: "bu kaynakta ücretli ek kullanım veya modele göre limit verisi yok — bunlar için Anthropic uç noktası gerekir",
    ca: "aquesta font no té dades d'ús extra de pagament ni de límits per model — per a això cal l'endpoint d'Anthropic",
    bg: "този източник няма данни за платено допълнително използване и лимити по модел — за тях е нужен ендпойнтът на Anthropic",
    hr: "ovaj izvor nema podatke o plaćenom višku potrošnje ni limitima po modelu — za to je potreban Anthropicov endpoint",
    sr: "овај извор нема податке о плаћеном вишку потрошње ни лимитима по моделу — за то је потребан Anthropic ендпоинт",
    lt: "šiame šaltinyje nėra duomenų apie mokamą papildomą naudojimą ar limitus pagal modelį — tam reikia Anthropic prieigos taško",
    ja: "このソースには有料の超過使用やモデル別上限のデータはありません。取得には Anthropic のエンドポイントが必要です。",
    ko: "이 소스에는 유료 초과 사용이나 모델별 한도 데이터가 없습니다. 해당 데이터에는 Anthropic 엔드포인트가 필요합니다.",
    zh: "此来源不含付费超额用量和按模型限额的数据——这些数据需要 Anthropic 接口。",
    vi: "Nguồn này không có dữ liệu dùng vượt mức trả phí hay giới hạn theo mô hình — những dữ liệu đó cần endpoint của Anthropic.",
    th: "แหล่งข้อมูลนี้ไม่มีข้อมูลการใช้เกินโควตาแบบชำระเงินหรือลิมิตตามโมเดล — ข้อมูลเหล่านี้ต้องใช้จุดเชื่อมต่อของ Anthropic",
    id: "sumber ini tidak memiliki data pemakaian ekstra berbayar atau batas per model — keduanya memerlukan endpoint Anthropic",
    ms: "sumber ini tiada data penggunaan lebihan berbayar atau had mengikut model — kedua-duanya memerlukan endpoint Anthropic",
    fil: "walang data ang source na ito sa bayad na sobrang paggamit o limitasyon bawat model — kailangan ng Anthropic endpoint para sa mga iyon",
    hi: "इस स्रोत में सशुल्क अतिरिक्त उपयोग या मॉडल अनुसार सीमा का डेटा नहीं है — इनके लिए Anthropic एंडपॉइंट चाहिए।",
    ar: "لا يوفّر هذا المصدر بيانات الاستخدام الزائد المدفوع أو الحدود حسب النموذج — فهذه تتطلّب مسار Anthropic",
    he: "למקור זה אין נתוני חריגה בתשלום או מגבלות לפי מודל — אלה דורשים את נקודת הקצה של Anthropic",
    fa: "این منبع داده مصرف اضافه پولی یا حد به تفکیک مدل را ندارد — این‌ها به نقطه پایانی Anthropic نیاز دارند",
  };
  for (const k in SOURCE_SCOPE_NOTE) if (DICT[k]) DICT[k].source_scope_note = SOURCE_SCOPE_NOTE[k];

  const ALIAS = { no: 'nb', nn: 'nb', iw: 'he', tl: 'fil', in: 'id' };

  function normalize(loc) {
    if (!loc) return 'en';
    loc = String(loc).toLowerCase();
    if (DICT[loc]) return loc;
    const base = loc.split(/[-_]/)[0];
    const b = ALIAS[base] || base;
    return DICT[b] ? b : 'en';
  }

  function isRTL(code) { return RTL.has(normalize(code)); }

  function t(locale, key) {
    const d = DICT[locale] || DICT.en;
    return d[key] != null ? d[key] : (DICT.en[key] != null ? DICT.en[key] : key);
  }

  const api = { LANGS, DICT, RTL, normalize, isRTL, t };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.I18N = api;
})();
