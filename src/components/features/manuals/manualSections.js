const section = (id, title, startPage, endPage, description, keywords = []) => ({
    id,
    title,
    startPage,
    endPage,
    description,
    keywords
});

const DND_PLAYER = [
    {
        id: 'orientamento',
        title: 'Orientarsi nel gioco',
        description: 'Per capire come funziona il gioco e come usare il manuale.',
        sections: [
            section('introduzione', 'Introduzione e regole essenziali', 1, 8, 'Come si gioca, ruolo del giocatore, d20, vantaggio e tipi di avventura.', [
                'iniziare', 'prime regole', 'come giocare', 'dadi', 'vantaggio', 'svantaggio', 'avventura'
            ])
        ]
    },
    {
        id: 'parte-1',
        title: 'Parte 1 — Creazione del personaggio',
        description: 'Tutto ciò che serve per costruire, descrivere ed equipaggiare un personaggio.',
        sections: [
            section('creazione-personaggio', 'Guida alla creazione del personaggio', 9, 16, 'Passaggi completi: razza, classe, caratteristiche, background ed equipaggiamento.', [
                'creare eroe', 'nuovo personaggio', 'scheda', 'livello 1', 'punti ferita', 'caratteristiche'
            ]),
            section('razze', 'Razze', 17, 44, 'Tratti, linguaggi, velocità e capacità delle stirpi giocabili.', [
                'specie', 'popoli', 'nano', 'elfo', 'halfling', 'umano', 'dragonide', 'gnomo', 'mezzelfo', 'mezzorco', 'tiefling'
            ]),
            section('nano', 'Nani', 18, 22, 'Robustezza, sottorazze e tratti dei nani.', ['montagna', 'collina', 'scurovisione']),
            section('elfo', 'Elfi', 23, 29, 'Elfi alti, dei boschi e drow con i relativi tratti.', ['drow', 'elfo alto', 'elfo dei boschi']),
            section('halfling', 'Halfling', 30, 32, 'Fortuna, agilità e sottorazze halfling.', ['piedelesto', 'tozzo', 'fortunato']),
            section('umano', 'Umani', 33, 35, 'Tratti umani e variante con talento.', ['variante umana', 'talento']),
            section('razze-inusuali', 'Dragonidi, gnomi, mezzelfi, mezzorchi e tiefling', 36, 44, 'Le stirpi meno comuni e le loro capacità distintive.', [
                'dragonide', 'gnomo', 'mezzelfo', 'mezzorco', 'tiefling', 'retaggio'
            ]),
            section('classi', 'Classi', 45, 120, 'Progressione, privilegi, sottoclassi e capacità delle dodici classi.', [
                'cosa sa fare', 'ruolo', 'livelli', 'sottoclasse', 'privilegi', 'dado vita'
            ]),
            section('barbaro', 'Barbaro', 46, 50, 'Ira, resistenza, combattimento fisico e cammini primordiali.', ['ira', 'berserker', 'totem']),
            section('bardo', 'Bardo', 51, 56, 'Ispirazione, magia, competenze e collegi bardici.', ['ispirazione bardica', 'collegio', 'incantatore']),
            section('chierico', 'Chierico', 57, 64, 'Domini divini, incantesimi, scacciare non morti e intervento divino.', ['dominio', 'divinità', 'guarire', 'scacciare']),
            section('druido', 'Druido', 65, 70, 'Forma selvatica, circoli druidici, natura e magia primordiale.', ['forma selvatica', 'circolo', 'animali']),
            section('guerriero', 'Guerriero', 71, 76, 'Stili di combattimento, azione impetuosa e archetipi marziali.', ['campione', 'maestro di battaglia', 'cavaliere mistico']),
            section('monaco', 'Monaco', 77, 82, 'Ki, arti marziali, movimento e tradizioni monastiche.', ['ki', 'colpi senz armi', 'arti marziali']),
            section('paladino', 'Paladino', 83, 88, 'Punizione divina, aure, giuramenti e magia sacra.', ['giuramento', 'punizione', 'aura']),
            section('ranger', 'Ranger', 89, 94, 'Esplorazione, nemico prescelto, archetipi e magia della natura.', ['esploratore', 'cacciatore', 'signore delle bestie']),
            section('ladro', 'Ladro', 95, 100, 'Attacco furtivo, azione scaltra, competenze e archetipi ladreschi.', ['furtivo', 'scassinare', 'assassino']),
            section('stregone', 'Stregone', 101, 106, 'Origini stregonesche, punti stregoneria e metamagia.', ['metamagia', 'discendenza draconica', 'magia selvaggia']),
            section('warlock', 'Warlock', 107, 113, 'Patrono ultraterreno, suppliche e magia del patto.', ['patrono', 'patto', 'suppliche occulte']),
            section('mago', 'Mago', 114, 120, 'Libro degli incantesimi, scuole arcane e preparazione della magia.', ['scuola di magia', 'libro incantesimi', 'arcano']),
            section('personalita-background', 'Personalità e background', 121, 142, 'Ideali, legami, difetti, allineamento e storie di provenienza.', [
                'storia personale', 'carattere', 'allineamento', 'ideale', 'legame', 'difetto', 'background'
            ]),
            section('equipaggiamento', 'Equipaggiamento', 143, 162, 'Armi, armature, denaro, strumenti, merci e attrezzatura da avventura.', [
                'comprare', 'prezzo', 'arma', 'armatura', 'zaino', 'oggetti', 'monete', 'trasporto'
            ]),
            section('personalizzazione', 'Opzioni di personalizzazione', 163, 170, 'Multiclasse e talenti per differenziare il personaggio.', [
                'multiclasse', 'talenti', 'personalizzare', 'combinare classi', 'specializzazione'
            ])
        ]
    },
    {
        id: 'parte-2',
        title: 'Parte 2 — Regole dell’avventura',
        description: 'Prove, esplorazione, riposo, movimento e combattimento.',
        sections: [
            section('caratteristiche-prove', 'Usare i punteggi di caratteristica', 171, 180, 'Prove, abilità, competenza, vantaggio, collaborazione e tiri salvezza.', [
                'riuscire azione', 'prova', 'abilità', 'competenza', 'tiro salvezza', 'cd', 'forza', 'destrezza'
            ]),
            section('avventura', 'All’avventura', 181, 188, 'Tempo, viaggio, movimento, ambiente, riposo e interazione sociale.', [
                'esplorare', 'viaggiare', 'riposo breve', 'riposo lungo', 'luce', 'cibo', 'movimento'
            ]),
            section('combattimento', 'Combattimento', 189, 198, 'Iniziativa, turni, azioni, movimento, attacchi, danni e guarigione.', [
                'battaglia', 'attaccare', 'azione bonus', 'reazione', 'opportunità', 'copertura', 'cadere a zero', 'morte'
            ])
        ]
    },
    {
        id: 'parte-3',
        title: 'Parte 3 — Regole della magia',
        description: 'Come funziona la magia e l’elenco completo degli incantesimi.',
        sections: [
            section('regole-magia', 'Magia', 199, 206, 'Slot, preparazione, bersagli, aree, durata, concentrazione e componenti.', [
                'lanciare magia', 'slot', 'concentrazione', 'rituale', 'componenti', 'bersaglio', 'area effetto'
            ]),
            section('incantesimi', 'Incantesimi', 207, 289, 'Liste per classe e descrizioni complete degli incantesimi in ordine alfabetico.', [
                'magie', 'trucchetti', 'lista incantesimi', 'livello incantesimo', 'effetti magici'
            ])
        ]
    },
    {
        id: 'appendici',
        title: 'Appendici e consultazione rapida',
        description: 'Condizioni, divinità, piani, creature e indice analitico.',
        sections: [
            section('condizioni', 'Condizioni', 290, 292, 'Effetti come accecato, afferrato, avvelenato, prono e stordito.', [
                'stato', 'effetto', 'prono', 'spaventato', 'affascinato', 'invisibile', 'incapacitato'
            ]),
            section('divinita', 'Divinità del multiverso', 293, 299, 'Pantheon, domini e allineamenti delle divinità.', ['dio', 'dea', 'pantheon', 'religione', 'dominio']),
            section('piani', 'Piani di esistenza', 300, 303, 'Piani materiali, elementali, esterni e cosmologia.', ['multiverso', 'piano astrale', 'piano etereo', 'inferi']),
            section('creature-giocatore', 'Statistiche delle creature', 304, 312, 'Creature utili a famigli, evocazioni, cavalcature e trasformazioni.', [
                'animale', 'bestia', 'famiglio', 'evocare', 'forma selvatica', 'cavalcatura'
            ]),
            section('indice-analitico', 'Indice analitico', 313, 321, 'Elenco alfabetico dei termini e delle relative pagine.', ['indice', 'termine', 'pagina', 'riferimento'])
        ]
    }
];

const DND_MASTER = [
    {
        id: 'orientamento',
        title: 'Orientarsi come Dungeon Master',
        description: 'Ruolo del DM, preparazione e uso del manuale.',
        sections: [
            section('introduzione-dm', 'Introduzione al ruolo del Dungeon Master', 1, 8, 'Responsabilità del DM, stili di gioco, arbitraggio e struttura del manuale.', [
                'iniziare come master', 'preparare', 'narrare', 'regole del tavolo'
            ])
        ]
    },
    {
        id: 'parte-1',
        title: 'Parte 1 — Il maestro dei mondi',
        description: 'Creare ambientazioni, cosmologie, culture e grandi forze del mondo.',
        sections: [
            section('mondo-dm', 'Il mondo del Dungeon Master', 9, 42, 'Divinità, geografia, politica, magia, fazioni, storia e tono della campagna.', [
                'creare mondo', 'ambientazione', 'regni', 'fazioni', 'religione', 'mappe', 'campagna'
            ]),
            section('multiverso', 'Creare un multiverso', 43, 68, 'Piani di esistenza, viaggi planari e cosmologie.', [
                'piani', 'cosmologia', 'astrale', 'etereo', 'elementale', 'inferi', 'teletrasporto'
            ])
        ]
    },
    {
        id: 'parte-2',
        title: 'Parte 2 — Il maestro delle avventure',
        description: 'Progettare avventure, PNG, luoghi, attività tra sessioni e ricompense.',
        sections: [
            section('creare-avventure', 'Creare le avventure', 69, 88, 'Obiettivi, incontri, eventi, misteri, complicazioni e struttura narrativa.', [
                'scrivere avventura', 'missione', 'trama', 'incontri', 'villain', 'obiettivo', 'evento'
            ]),
            section('png', 'Creare i personaggi non giocanti', 89, 98, 'Aspetto, motivazioni, statistiche, seguaci, contatti e antagonisti.', [
                'png', 'npc', 'alleato', 'nemico', 'personalità', 'motivazione', 'seguace'
            ]),
            section('ambienti', 'Ambienti delle avventure', 99, 124, 'Dungeon, terre selvagge, insediamenti, tempo atmosferico, trappole e pericoli.', [
                'dungeon', 'città', 'viaggio', 'tempo', 'trappola', 'pericolo', 'porta', 'foresta'
            ]),
            section('tra-avventure', 'Tra le avventure', 125, 132, 'Downtime, spese, attività, addestramento e gestione della campagna.', [
                'tempo libero', 'downtime', 'lavoro', 'addestrarsi', 'costruire', 'ricerca', 'spese'
            ]),
            section('tesori', 'Tesori e ricompense', 133, 149, 'Denaro, gemme, oggetti d’arte, tabelle casuali e distribuzione delle ricompense.', [
                'bottino', 'ricompensa', 'monete', 'gemme', 'tesoro casuale', 'valore'
            ]),
            section('oggetti-magici', 'Oggetti magici A-Z', 150, 213, 'Descrizioni, rarità, sintonia, uso e proprietà degli oggetti magici.', [
                'artefatto', 'pozione', 'pergamena', 'arma magica', 'armatura magica', 'bacchetta', 'anello'
            ]),
            section('oggetti-speciali', 'Oggetti senzienti, artefatti e proprietà speciali', 214, 232, 'Personalità degli oggetti, artefatti, proprietà benefiche e nocive.', [
                'oggetto senziente', 'artefatto', 'maledizione', 'proprietà casuale', 'distruggere artefatto'
            ])
        ]
    },
    {
        id: 'parte-3',
        title: 'Parte 3 — Il maestro delle regole',
        description: 'Gestire il tavolo e personalizzare le regole.',
        sections: [
            section('condurre-gioco', 'Condurre il gioco', 233, 262, 'Regole del tavolo, CD, ispirazione, esplorazione, combattimento, oggetti e follia.', [
                'arbitrare', 'difficoltà', 'improvvisare', 'ispirazione', 'danni', 'combattimento', 'follia'
            ]),
            section('laboratorio-dm', 'Il laboratorio del Dungeon Master', 263, 289, 'Varianti, regole opzionali, mostri, incantesimi, classi e sistemi personalizzati.', [
                'regola opzionale', 'variante', 'creare mostro', 'creare incantesimo', 'modificare classe', 'riposo'
            ])
        ]
    },
    {
        id: 'appendici',
        title: 'Appendici e strumenti',
        description: 'Generatori, liste, mappe e riferimenti.',
        sections: [
            section('dungeon-casuali', 'Dungeon casuali', 290, 301, 'Tabelle per generare stanze, passaggi, porte, trappole e contenuti.', [
                'generatore', 'casuale', 'stanza', 'corridoio', 'dungeon'
            ]),
            section('liste-mostri', 'Liste dei mostri', 302, 309, 'Creature ordinate per ambiente e grado di sfida.', [
                'mostri per ambiente', 'grado sfida', 'incontro', 'creature'
            ]),
            section('mappe-dm', 'Mappe', 310, 315, 'Esempi e riferimenti visivi per avventure e luoghi.', ['mappa', 'edificio', 'dungeon', 'nave']),
            section('ispirazione-dm', 'Ispirazione per il Dungeon Master', 316, 319, 'Opere e fonti da cui trarre idee per campagne e avventure.', [
                'idee', 'libri', 'film', 'ispirazione', 'letture'
            ]),
            section('indice-dm', 'Indice analitico', 320, 320, 'Riferimenti alfabetici agli argomenti del manuale.', ['indice', 'pagina', 'termine'])
        ]
    }
];

const DND_MONSTERS = [
    {
        id: 'uso-manuale',
        title: 'Usare le creature',
        description: 'Capire statistiche, capacità, grado di sfida e azioni dei mostri.',
        sections: [
            section('leggere-statistiche', 'Come leggere una scheda di mostro', 1, 11, 'Tipo, allineamento, difese, sensi, sfida, azioni, reazioni e creature leggendarie.', [
                'stat block', 'scheda', 'grado sfida', 'classe armatura', 'punti ferita', 'sensi', 'multiattacco'
            ])
        ]
    },
    {
        id: 'bestiario',
        title: 'Bestiario alfabetico',
        description: 'Creature, tattiche, habitat e statistiche ordinate alfabeticamente.',
        sections: [
            section('mostri-a-c', 'Creature A–C', 12, 49, 'Da aarakocra e aboleth fino a chimere, coboldi e cultisti.', [
                'aboleth', 'angelo', 'ankheg', 'arpia', 'basilisco', 'bugbear', 'centauro', 'chimera', 'coboldo'
            ]),
            section('mostri-d-f', 'Creature D–F', 50, 142, 'Demoni, diavoli, draghi, drow, elementali, ettercap e fuochi fatui.', [
                'demone', 'diavolo', 'drago', 'drow', 'driade', 'elementale', 'efreeti', 'ettercap'
            ]),
            section('mostri-g-i', 'Creature G–I', 143, 186, 'Ghoul, giganti, gith, gnoll, goblin, golem, grifoni e creature umanoidi.', [
                'ghoul', 'gigante', 'gith', 'gnoll', 'goblin', 'golem', 'grick', 'grifone', 'hobgoblin'
            ]),
            section('mostri-k-m', 'Creature K–M', 187, 234, 'Coboldi, kraken, lamie, lich, licantropi, megere, melme, mind flayer e mummie.', [
                'kobold', 'kraken', 'lamia', 'lich', 'licantropo', 'manticora', 'medusa', 'mimic', 'mummia'
            ]),
            section('mostri-n-r', 'Creature N–R', 235, 265, 'Nothic, ogre, orchi, orsigufo, pegasi, peryton, rakshasa, remorhaz e roc.', [
                'nothic', 'ogre', 'oni', 'orco', 'otyugh', 'orsigufo', 'pegaso', 'peryton', 'rakshasa', 'roc'
            ]),
            section('mostri-s-z', 'Creature S–Z', 266, 316, 'Sahuagin, segugi infernali, scheletri, spettri, troll, vampiri, vermi e yuan-ti.', [
                'sahuagin', 'segugio infernale', 'scheletro', 'spettro', 'troll', 'vampiro', 'verme purpureo', 'wight', 'yuan ti', 'zombie'
            ])
        ]
    },
    {
        id: 'appendici',
        title: 'Appendici',
        description: 'Animali, creature comuni e personaggi non giocanti pronti all’uso.',
        sections: [
            section('creature-varie', 'Creature varie', 317, 341, 'Bestie, animali, sciami, cavalcature e creature comuni.', [
                'animale', 'bestia', 'cavallo', 'cane', 'orso', 'lupo', 'sciame', 'famiglio'
            ]),
            section('png-mostri', 'Personaggi non giocanti', 342, 353, 'Archetipi come banditi, guardie, maghi, sacerdoti e veterani.', [
                'png', 'npc', 'bandito', 'guardia', 'mago', 'sacerdote', 'veterano', 'assassino'
            ])
        ]
    }
];

const PF_BASE = [
    {
        id: 'regole-base',
        title: 'Regole e personaggi',
        description: 'Le aree principali del gioco Pathfinder disponibili in archivio.',
        sections: [
            section('pf-creazione', 'Creazione del personaggio', 1, 1, 'Stirpe, background, classe, caratteristiche e competenze.', ['creare personaggio', 'stirpe', 'background', 'classe']),
            section('pf-prove', 'Prove e gradi di successo', 2, 2, 'Tiri d20, CD, critici e modificatori.', ['prova', 'cd', 'critico', 'successo']),
            section('pf-azioni', 'Azioni in combattimento', 3, 3, 'Tre azioni, reazioni, movimento e interazioni.', ['combattimento', 'turno', 'reazione', 'muoversi']),
            section('pf-attacchi', 'Attacchi e penalità multiple', 4, 4, 'MAP, portata, copertura, fiancheggiamento e condizioni.', ['attacco', 'map', 'copertura', 'fiancheggiamento']),
            section('pf-incantesimi', 'Incantesimi', 5, 5, 'Tradizioni, CD, focus, preparazione e tiri per colpire.', ['magia', 'focus', 'tradizione', 'incantatore']),
            section('pf-esplorazione', 'Esplorazione', 6, 6, 'Attività, percezione, investigazione, furtività e viaggio.', ['viaggio', 'percezione', 'furtività', 'investigare']),
            section('pf-equipaggiamento', 'Equipaggiamento', 7, 7, 'Armi, armature, tratti, alchimia e strumenti.', ['arma', 'armatura', 'oggetto', 'alchimia']),
            section('pf-progressione', 'Progressione', 8, 8, 'Livelli, talenti, punti ferita e competenze.', ['salire livello', 'talento', 'punti ferita']),
            section('pf-condizioni', 'Condizioni', 9, 9, 'Prono, spaventato, afferrato, ferito, morente e stabilizzato.', ['stato', 'morente', 'ferito', 'prono']),
            section('pf-promemoria', 'Promemoria del tavolo', 10, 10, 'PG, token, iniziativa e obiettivi della sessione.', ['iniziativa', 'token', 'obiettivi'])
        ]
    }
];

const PF_GM = [
    {
        id: 'gestione-gioco',
        title: 'Gestire avventure e sessioni',
        description: 'Strumenti essenziali per preparare e condurre il tavolo.',
        sections: [
            section('pf-gm-cd', 'CD e difficoltà', 1, 1, 'Impostare difficoltà, modificatori e gradi di successo.', ['difficoltà', 'cd', 'prova']),
            section('pf-gm-incontri', 'Costruire gli incontri', 2, 2, 'Budget, livello del gruppo e minacce.', ['incontro', 'budget', 'minaccia']),
            section('pf-gm-ricompense', 'Ricompense e tesori', 3, 3, 'PE, denaro, oggetti e progressione.', ['tesoro', 'ricompensa', 'esperienza']),
            section('pf-gm-esplorazione', 'Gestire l’esplorazione', 4, 4, 'Viaggi, attività e passaggio al combattimento.', ['viaggio', 'esplorare', 'attività']),
            section('pf-gm-pericoli', 'Pericoli e trappole', 5, 5, 'Individuazione, disattivazione e conseguenze.', ['trappola', 'pericolo', 'disattivare']),
            section('pf-gm-condizioni', 'Condizioni e danni persistenti', 6, 6, 'Applicare e rimuovere effetti nel tempo.', ['danno persistente', 'condizione', 'effetto']),
            section('pf-gm-improvvisare', 'Improvvisare PNG', 7, 7, 'Statistiche rapide, atteggiamento e obiettivi.', ['png', 'npc', 'improvvisare']),
            section('pf-gm-tavolo', 'Gestione del tavolo', 8, 8, 'Ritmo, spotlight e strumenti di sicurezza.', ['ritmo', 'giocatori', 'sicurezza']),
            section('pf-gm-varianti', 'Varianti e regole opzionali', 9, 9, 'Modificare il tono e il livello di complessità.', ['variante', 'opzionale', 'regola']),
            section('pf-gm-campagna', 'Preparare una campagna', 10, 10, 'Temi, archi narrativi, fazioni e note.', ['campagna', 'trama', 'fazione'])
        ]
    }
];

const PF_BESTIARY = [
    {
        id: 'creature-per-ruolo',
        title: 'Creature per ruolo e utilizzo',
        description: 'Categorie pratiche per scegliere rapidamente un avversario.',
        sections: [
            section('pf-creature-basse', 'Creature di basso livello', 1, 1, 'Avversari semplici per gruppi alle prime armi.', ['facile', 'basso livello']),
            section('pf-creature-medie', 'Creature di livello medio', 2, 2, 'Nemici con capacità tattiche più articolate.', ['medio', 'tattica']),
            section('pf-creature-alte', 'Creature di alto livello', 3, 3, 'Minacce importanti e avversari principali.', ['alto livello', 'boss']),
            section('pf-sciami', 'Sciami e gruppi', 4, 4, 'Molte creature trattate come una singola minaccia.', ['sciame', 'orda', 'gruppo']),
            section('pf-volanti', 'Creature volanti', 5, 5, 'Movimento aereo, quota e attacchi in volo.', ['volare', 'aria', 'ali']),
            section('pf-acquatiche', 'Creature acquatiche', 6, 6, 'Nuoto, combattimento sott’acqua e ambienti marini.', ['acqua', 'nuotare', 'mare']),
            section('pf-non-morti', 'Non morti', 7, 7, 'Creature animate da energie necromantiche.', ['zombie', 'scheletro', 'non morto']),
            section('pf-immondi', 'Immondi e creature planari', 8, 8, 'Minacce extraplanari e resistenze particolari.', ['demone', 'diavolo', 'planare']),
            section('pf-bestie', 'Bestie e animali', 9, 9, 'Fauna, compagni e creature naturali.', ['animale', 'bestia', 'natura']),
            section('pf-pericoli-creature', 'Pericoli e creature speciali', 10, 10, 'Minacce ambientali e avversari insoliti.', ['pericolo', 'ambiente', 'speciale'])
        ]
    }
];

export const MANUAL_SECTION_CATALOG = {
    dnd5e: {
        player: DND_PLAYER,
        master: DND_MASTER,
        monsters: DND_MONSTERS
    },
    pathfinder2e: {
        base: PF_BASE,
        gm: PF_GM,
        bestiary: PF_BESTIARY
    }
};

export const getManualSectionGroups = (systemId, manualId) =>
    MANUAL_SECTION_CATALOG[systemId]?.[manualId] || [];

export const getManualSections = (systemId, manualId) =>
    getManualSectionGroups(systemId, manualId).flatMap(group =>
        group.sections.map(item => ({ ...item, groupId: group.id, groupTitle: group.title }))
    );

export const getSectionById = (systemId, manualId, sectionId) =>
    getManualSections(systemId, manualId).find(item => item.id === sectionId) || null;

export const getSectionForPage = (systemId, manualId, page) =>
    getManualSections(systemId, manualId)
        .filter(item => page >= item.startPage && page <= item.endPage)
        .sort((a, b) => (a.endPage - a.startPage) - (b.endPage - b.startPage))[0] || null;
