#!/usr/bin/env python3
"""Translate ALL fishery referentials to FR (with accents), PT and AR."""
import paramiko, json, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_PASS = "@u-1baR.0rg$U24"

# Complete translations: code → {en, fr, pt, ar}
TRANSLATIONS = {
    # AGE_RANGE
    ("AGE_RANGE", "15_24"): {"en": "15 - 24", "fr": "15 - 24", "pt": "15 - 24", "ar": "15 - 24"},
    ("AGE_RANGE", "25_34"): {"en": "25 - 34", "fr": "25 - 34", "pt": "25 - 34", "ar": "25 - 34"},
    ("AGE_RANGE", "35_44"): {"en": "35 - 44", "fr": "35 - 44", "pt": "35 - 44", "ar": "35 - 44"},
    ("AGE_RANGE", "45_54"): {"en": "45 - 54", "fr": "45 - 54", "pt": "45 - 54", "ar": "45 - 54"},
    ("AGE_RANGE", "55_PLUS"): {"en": ">= 54", "fr": ">= 54", "pt": ">= 54", "ar": ">= 54"},
    # CULTURE_METHOD
    ("CULTURE_METHOD", "POND_CULTURE"): {"en": "Pond culture", "fr": "Pisciculture en étang", "pt": "Cultura em tanque", "ar": "استزراع في أحواض"},
    ("CULTURE_METHOD", "CAGE_CULTURE"): {"en": "Cage culture", "fr": "Élevage en cage", "pt": "Cultura em gaiola", "ar": "استزراع في أقفاص"},
    ("CULTURE_METHOD", "RACEWAY_CULTURE"): {"en": "Raceway culture", "fr": "Élevage en raceway", "pt": "Cultura em raceway", "ar": "استزراع في مجاري"},
    ("CULTURE_METHOD", "RAS_CULTURE"): {"en": "RAS culture", "fr": "Élevage en RAS", "pt": "Cultura em RAS", "ar": "استزراع في نظام إعادة التدوير"},
    ("CULTURE_METHOD", "PEN_CULTURE"): {"en": "Pen culture", "fr": "Élevage en enclos", "pt": "Cultura em cercado", "ar": "استزراع في حظائر"},
    ("CULTURE_METHOD", "INTEGRATED"): {"en": "Integrated aquaculture", "fr": "Aquaculture intégrée", "pt": "Aquicultura integrada", "ar": "استزراع مائي متكامل"},
    # EFFORT_TYPE
    ("EFFORT_TYPE", "NUM_VESSELS"): {"en": "Number of Vessels", "fr": "Nombre de navires", "pt": "Número de embarcações", "ar": "عدد السفن"},
    ("EFFORT_TYPE", "NUM_FISHING_DAYS"): {"en": "Number of Fishing days", "fr": "Nombre de jours de pêche", "pt": "Número de dias de pesca", "ar": "عدد أيام الصيد"},
    ("EFFORT_TYPE", "NUM_FISHING_TRIPS"): {"en": "Number of Fishing trips", "fr": "Nombre de sorties de pêche", "pt": "Número de viagens de pesca", "ar": "عدد رحلات الصيد"},
    ("EFFORT_TYPE", "NUM_FISHERMEN"): {"en": "Number of Fishermen", "fr": "Nombre de pêcheurs", "pt": "Número de pescadores", "ar": "عدد الصيادين"},
    # FARM_TYPE
    ("FARM_TYPE", "POND"): {"en": "Ponds", "fr": "Étangs", "pt": "Tanques", "ar": "أحواض"},
    ("FARM_TYPE", "CAGE"): {"en": "Cage", "fr": "Cage flottante", "pt": "Gaiola flutuante", "ar": "قفص عائم"},
    ("FARM_TYPE", "RACEWAY"): {"en": "Raceway", "fr": "Raceway / Canal", "pt": "Raceway / Canal", "ar": "مجرى مائي"},
    ("FARM_TYPE", "TANK"): {"en": "Tank", "fr": "Bassin / Bac", "pt": "Tanque / Reservatório", "ar": "خزان"},
    ("FARM_TYPE", "RAS"): {"en": "Recirculating aquaculture system (RAS)", "fr": "Système aquacole en recirculation (RAS)", "pt": "Sistema de recirculação aquícola (RAS)", "ar": "نظام الاستزراع بإعادة التدوير"},
    ("FARM_TYPE", "RACKS"): {"en": "Racks", "fr": "Casiers / Racks", "pt": "Estantes / Racks", "ar": "رفوف"},
    ("FARM_TYPE", "PEN"): {"en": "Pen / Enclosure", "fr": "Enclos", "pt": "Cercado", "ar": "حظيرة"},
    ("FARM_TYPE", "LONG_LINES"): {"en": "Long lines", "fr": "Filières", "pt": "Espinhéis", "ar": "خطوط طويلة"},
    ("FARM_TYPE", "TUBES_BASKET"): {"en": "Tubes / Basket", "fr": "Tubes / Paniers", "pt": "Tubos / Cestos", "ar": "أنابيب / سلال"},
    # FISH_CATEGORY
    ("FISH_CATEGORY", "FINFISH"): {"en": "Finfish", "fr": "Poissons", "pt": "Peixes", "ar": "أسماك"},
    ("FISH_CATEGORY", "SEAWEED"): {"en": "Seaweed", "fr": "Algues", "pt": "Algas", "ar": "أعشاب بحرية"},
    ("FISH_CATEGORY", "CRUSTACEAN"): {"en": "Crustacean", "fr": "Crustacé", "pt": "Crustáceo", "ar": "قشريات"},
    ("FISH_CATEGORY", "SHELLFISH"): {"en": "Shellfish", "fr": "Coquillages / Crustacés", "pt": "Mariscos", "ar": "محار"},
    ("FISH_CATEGORY", "MOLLUSC"): {"en": "Mollusc", "fr": "Mollusque", "pt": "Molusco", "ar": "رخويات"},
    ("FISH_CATEGORY", "AQUATIC_PLANT"): {"en": "Aquatic plant / Seaweed", "fr": "Plante aquatique / Algue", "pt": "Planta aquática / Alga", "ar": "نبات مائي / أعشاب بحرية"},
    ("FISH_CATEGORY", "CEPHALOPOD"): {"en": "Cephalopod", "fr": "Céphalopode", "pt": "Cefalópode", "ar": "رأسيات الأرجل"},
    # FISHERY_TYPE
    ("FISHERY_TYPE", "ARTISANAL_GLEANER"): {"en": "Artisanal / Gleaner", "fr": "Artisanal / Glaneur", "pt": "Artesanal / Catador", "ar": "حرفي / جامع"},
    ("FISHERY_TYPE", "ARTISANAL"): {"en": "Artisanal", "fr": "Artisanal", "pt": "Artesanal", "ar": "حرفي"},
    ("FISHERY_TYPE", "SEMI_INDUSTRIAL"): {"en": "Semi-industrial", "fr": "Semi-industriel", "pt": "Semi-industrial", "ar": "شبه صناعي"},
    ("FISHERY_TYPE", "INDUSTRIAL"): {"en": "Industrial", "fr": "Industriel", "pt": "Industrial", "ar": "صناعي"},
    ("FISHERY_TYPE", "RECREATIONAL"): {"en": "Recreational", "fr": "Récréatif", "pt": "Recreativo", "ar": "ترفيهي"},
    ("FISHERY_TYPE", "GLEANING"): {"en": "Gleaning", "fr": "Glanage", "pt": "Catação", "ar": "جمع"},
    # FISHING_AREA
    ("FISHING_AREA", "01"): {"en": "Africa — Inland waters", "fr": "Afrique — Eaux intérieures", "pt": "África — Águas interiores", "ar": "أفريقيا — المياه الداخلية"},
    ("FISHING_AREA", "34"): {"en": "Atlantic, Eastern Central", "fr": "Atlantique, Centre-Est", "pt": "Atlântico, Centro-Leste", "ar": "الأطلسي، الوسط الشرقي"},
    ("FISHING_AREA", "47"): {"en": "Atlantic, Southeast", "fr": "Atlantique, Sud-Est", "pt": "Atlântico, Sudeste", "ar": "الأطلسي، الجنوب الشرقي"},
    ("FISHING_AREA", "51"): {"en": "Indian Ocean, Western", "fr": "Océan Indien, Ouest", "pt": "Oceano Índico, Ocidental", "ar": "المحيط الهندي، الغربي"},
    ("FISHING_AREA", "57"): {"en": "Indian Ocean, Eastern", "fr": "Océan Indien, Est", "pt": "Oceano Índico, Oriental", "ar": "المحيط الهندي، الشرقي"},
    ("FISHING_AREA", "37"): {"en": "Mediterranean and Black Sea", "fr": "Méditerranée et Mer Noire", "pt": "Mediterrâneo e Mar Negro", "ar": "البحر الأبيض المتوسط والبحر الأسود"},
    # FISHING_ENVIRONMENT
    ("FISHING_ENVIRONMENT", "FRESHWATER"): {"en": "Freshwater", "fr": "Eau douce", "pt": "Água doce", "ar": "مياه عذبة"},
    ("FISHING_ENVIRONMENT", "BRACKISH"): {"en": "Brackish", "fr": "Eau saumâtre", "pt": "Água salobra", "ar": "مياه معتدلة الملوحة"},
    ("FISHING_ENVIRONMENT", "MARINE"): {"en": "Marine", "fr": "Marine", "pt": "Marinha", "ar": "بحرية"},
    # FISHING_SYSTEM
    ("FISHING_SYSTEM", "EXTENSIVE"): {"en": "Extensive", "fr": "Extensif", "pt": "Extensivo", "ar": "مكثف"},
    ("FISHING_SYSTEM", "INTENSIVE"): {"en": "Intensive", "fr": "Intensif", "pt": "Intensivo", "ar": "كثيف"},
    ("FISHING_SYSTEM", "SEMI_INTENSIVE"): {"en": "Semi-intensive", "fr": "Semi-intensif", "pt": "Semi-intensivo", "ar": "شبه كثيف"},
    # GEAR_TYPE
    ("GEAR_TYPE", "GILLNET"): {"en": "Gillnet", "fr": "Filet maillant", "pt": "Rede de emalhar", "ar": "شبكة خيشومية"},
    ("GEAR_TYPE", "SEINE"): {"en": "Seine net", "fr": "Senne", "pt": "Rede de cerco", "ar": "شبكة جرف"},
    ("GEAR_TYPE", "TRAWL"): {"en": "Trawl net", "fr": "Chalut", "pt": "Rede de arrasto", "ar": "شبكة جر"},
    ("GEAR_TYPE", "LONGLINE"): {"en": "Longline", "fr": "Palangre", "pt": "Espinhel", "ar": "خيط طويل"},
    ("GEAR_TYPE", "TRAP"): {"en": "Trap", "fr": "Nasse / Casier", "pt": "Armadilha / Covo", "ar": "مصيدة"},
    ("GEAR_TYPE", "CAST_NET"): {"en": "Cast net", "fr": "Épervier", "pt": "Rede de lançamento", "ar": "شبكة إلقاء"},
    ("GEAR_TYPE", "BEACH_SEINE"): {"en": "Beach seine", "fr": "Senne de plage", "pt": "Rede de praia", "ar": "شبكة شاطئية"},
    ("GEAR_TYPE", "PURSE_SEINE"): {"en": "Purse seine", "fr": "Senne coulissante", "pt": "Rede de cerco com retenida", "ar": "شبكة محيطة"},
    ("GEAR_TYPE", "DREDGE"): {"en": "Dredge", "fr": "Drague", "pt": "Draga", "ar": "جرافة"},
    ("GEAR_TYPE", "HOOK_LINE"): {"en": "Hook and line", "fr": "Ligne et hameçon", "pt": "Linha e anzol", "ar": "خطاف وخيط"},
    ("GEAR_TYPE", "DRAG_NET"): {"en": "Drag net", "fr": "Filet traînant", "pt": "Rede de arrasto", "ar": "شبكة سحب"},
    # GENDER
    ("GENDER", "MALE"): {"en": "Male", "fr": "Masculin", "pt": "Masculino", "ar": "ذكر"},
    ("GENDER", "FEMALE"): {"en": "Female", "fr": "Féminin", "pt": "Feminino", "ar": "أنثى"},
    ("GENDER", "NOT_DISCLOSED"): {"en": "Prefer not to disclose", "fr": "Préfère ne pas divulguer", "pt": "Prefere não divulgar", "ar": "يفضل عدم الإفصاح"},
    # OPERATIONAL_SIZE
    ("OPERATIONAL_SIZE", "SMALL"): {"en": "Small scale (below 5 mt/yr)", "fr": "Petite échelle (moins de 5 t/an)", "pt": "Pequena escala (menos de 5 t/ano)", "ar": "نطاق صغير (أقل من 5 طن/سنة)"},
    ("OPERATIONAL_SIZE", "MEDIUM"): {"en": "Medium (between 5 - 50 mt/yr)", "fr": "Moyen (entre 5 - 50 t/an)", "pt": "Médio (entre 5 - 50 t/ano)", "ar": "متوسط (بين 5 - 50 طن/سنة)"},
    ("OPERATIONAL_SIZE", "LARGE"): {"en": "Large (above 50 mt/yr)", "fr": "Grande échelle (plus de 50 t/an)", "pt": "Grande escala (mais de 50 t/ano)", "ar": "نطاق كبير (أكثر من 50 طن/سنة)"},
    # PRODUCTION_NODE
    ("PRODUCTION_NODE", "HATCHERY"): {"en": "Hatchery", "fr": "Écloserie", "pt": "Incubadora", "ar": "مفرخة"},
    ("PRODUCTION_NODE", "OUT_GROWER"): {"en": "Out-grower", "fr": "Sous-traitant grossissement", "pt": "Produtor externo", "ar": "مزارع خارجي"},
    ("PRODUCTION_NODE", "BROODSTOCK"): {"en": "Broodstock Production", "fr": "Production de géniteurs", "pt": "Produção de reprodutores", "ar": "إنتاج أمهات"},
    ("PRODUCTION_NODE", "OFFSHORE_CAGES"): {"en": "Marine aquaculture in offshore cages", "fr": "Aquaculture marine en cages offshore", "pt": "Aquicultura marinha em gaiolas offshore", "ar": "استزراع بحري في أقفاص بعيدة"},
    # PRODUCTION_TYPE
    ("PRODUCTION_TYPE", "AQUACULTURE"): {"en": "Aquaculture", "fr": "Aquaculture", "pt": "Aquicultura", "ar": "الاستزراع المائي"},
    ("PRODUCTION_TYPE", "CAPTURE"): {"en": "Capture fisheries", "fr": "Pêche de capture", "pt": "Pesca de captura", "ar": "صيد الأسماك"},
    # PRODUCT_STATE
    ("PRODUCT_STATE", "LIVE"): {"en": "Live", "fr": "Vivant", "pt": "Vivo", "ar": "حي"},
    ("PRODUCT_STATE", "FISH_OIL"): {"en": "Fish Oil", "fr": "Huile de poisson", "pt": "Óleo de peixe", "ar": "زيت سمك"},
    ("PRODUCT_STATE", "FISH_MEAL"): {"en": "Fish Meal", "fr": "Farine de poisson", "pt": "Farinha de peixe", "ar": "دقيق سمك"},
    ("PRODUCT_STATE", "FRESH"): {"en": "Fresh", "fr": "Frais", "pt": "Fresco", "ar": "طازج"},
    ("PRODUCT_STATE", "FROZEN"): {"en": "Frozen", "fr": "Congelé", "pt": "Congelado", "ar": "مجمد"},
    ("PRODUCT_STATE", "DRIED"): {"en": "Dried", "fr": "Séché", "pt": "Seco", "ar": "مجفف"},
    ("PRODUCT_STATE", "SMOKED"): {"en": "Smoked", "fr": "Fumé", "pt": "Fumado", "ar": "مدخن"},
    ("PRODUCT_STATE", "CANNED"): {"en": "Canned", "fr": "En conserve", "pt": "Em conserva", "ar": "معلب"},
    ("PRODUCT_STATE", "SALTED"): {"en": "Salted", "fr": "Salé", "pt": "Salgado", "ar": "مملح"},
    ("PRODUCT_STATE", "FILLETED"): {"en": "Filleted", "fr": "En filets", "pt": "Em filetes", "ar": "مقطع شرائح"},
    # TRADE_TYPE
    ("TRADE_TYPE", "EXPORT"): {"en": "Export", "fr": "Exportation", "pt": "Exportação", "ar": "تصدير"},
    ("TRADE_TYPE", "IMPORT"): {"en": "Import", "fr": "Importation", "pt": "Importação", "ar": "استيراد"},
    # VESSEL_TYPE
    ("VESSEL_TYPE", "CANOE"): {"en": "Canoe", "fr": "Pirogue", "pt": "Canoa", "ar": "زورق"},
    ("VESSEL_TYPE", "ARTISANAL"): {"en": "Artisanal canoe / pirogue", "fr": "Pirogue artisanale", "pt": "Canoa artesanal", "ar": "زورق حرفي"},
    ("VESSEL_TYPE", "SEMI_INDUSTRIAL"): {"en": "Semi-industrial vessel", "fr": "Navire semi-industriel", "pt": "Embarcação semi-industrial", "ar": "سفينة شبه صناعية"},
    ("VESSEL_TYPE", "INDUSTRIAL"): {"en": "Industrial vessel", "fr": "Navire industriel", "pt": "Embarcação industrial", "ar": "سفينة صناعية"},
    ("VESSEL_TYPE", "DEMERSAL_TRAWLER"): {"en": "Demersal Trawler", "fr": "Chalutier démersal", "pt": "Arrastão demersal", "ar": "سفينة جر قاعية"},
    ("VESSEL_TYPE", "PELAGIC_TRAWLER"): {"en": "Pelagic Trawler", "fr": "Chalutier pélagique", "pt": "Arrastão pelágico", "ar": "سفينة جر سطحية"},
    ("VESSEL_TYPE", "TRAWLER"): {"en": "Trawler", "fr": "Chalutier", "pt": "Arrastão", "ar": "سفينة جر"},
    ("VESSEL_TYPE", "PURSE_SEINER"): {"en": "Purse seiner", "fr": "Senneur", "pt": "Cercador", "ar": "سفينة شباك محيطة"},
    ("VESSEL_TYPE", "LONGLINER"): {"en": "Longliner", "fr": "Palangrier", "pt": "Espinheleiro", "ar": "سفينة خيوط طويلة"},
    ("VESSEL_TYPE", "GILLNETTER"): {"en": "Gillnetter", "fr": "Fileyeur", "pt": "Emalhadeira", "ar": "سفينة شباك خيشومية"},
    ("VESSEL_TYPE", "TUNA_FLEET"): {"en": "Tuna Fleet", "fr": "Flottille thonière", "pt": "Frota atuneira", "ar": "أسطول صيد التونة"},
    ("VESSEL_TYPE", "SHRIMPERS"): {"en": "Shrimpers", "fr": "Crevettier", "pt": "Camaroeiro", "ar": "سفينة صيد الروبيان"},
    ("VESSEL_TYPE", "BOAT"): {"en": "Boat", "fr": "Bateau", "pt": "Barco", "ar": "قارب"},
    # PAID refs (add PT/AR)
    ("PAID_CASH_MECHANISM", "CM_1"): {"en": "Bank transfer", "fr": "Virement bancaire", "pt": "Transferência bancária", "ar": "تحويل بنكي"},
    ("PAID_CASH_MECHANISM", "CM_2"): {"en": "Electronic voucher", "fr": "Bon électronique", "pt": "Vale eletrónico", "ar": "قسيمة إلكترونية"},
    ("PAID_CASH_MECHANISM", "CM_3"): {"en": "Mobile money", "fr": "Argent mobile", "pt": "Dinheiro móvel", "ar": "أموال عبر الهاتف"},
    ("PAID_CASH_MECHANISM", "CM_4"): {"en": "Other electronic cash", "fr": "Autre cash électronique", "pt": "Outro dinheiro eletrónico", "ar": "نقد إلكتروني آخر"},
    ("PAID_CASH_MECHANISM", "CM_5"): {"en": "Paper voucher", "fr": "Bon papier", "pt": "Vale em papel", "ar": "قسيمة ورقية"},
    ("PAID_CASH_MECHANISM", "CM_6"): {"en": "Physical cash", "fr": "Cash physique", "pt": "Dinheiro físico", "ar": "نقد مادي"},
    ("PAID_CVA_TYPE", "CVA_1"): {"en": "Cash - Cash For Work", "fr": "Cash contre travail", "pt": "Dinheiro por trabalho", "ar": "نقد مقابل العمل"},
    ("PAID_CVA_TYPE", "CVA_2"): {"en": "Cash - Conditional Transfer", "fr": "Transfert conditionnel", "pt": "Transferência condicional", "ar": "تحويل مشروط"},
    ("PAID_CVA_TYPE", "CVA_3"): {"en": "Cash - Unconditional Transfer", "fr": "Transfert inconditionnel", "pt": "Transferência incondicional", "ar": "تحويل غير مشروط"},
    ("PAID_CVA_TYPE", "CVA_4"): {"en": "Cash - Voucher @ Fairs", "fr": "Bons pour foires", "pt": "Vales para feiras", "ar": "قسائم للمعارض"},
    ("PAID_CVA_TYPE", "CVA_5"): {"en": "Cash - Voucher scheme", "fr": "Programme de bons", "pt": "Programa de vales", "ar": "برنامج القسائم"},
    ("PAID_PROJECT", "PRJ_RAFFS"): {"en": "RAFFS — Resilient African Feed and Fodder Systems", "fr": "RAFFS — Systèmes résilients d'alimentation animale en Afrique", "pt": "RAFFS — Sistemas resilientes de alimentação animal em África", "ar": "RAFFS — أنظمة الأعلاف المرنة في أفريقيا"},
    ("PAID_PROJECT", "PRJ_PPR"): {"en": "PPR — Pan African PPR Eradication Programme", "fr": "PPR — Programme panafricain d'éradication de la PPR", "pt": "PPR — Programa pan-africano de erradicação da PPR", "ar": "PPR — برنامج استئصال الطاعون البقري في أفريقيا"},
    ("PAID_PROJECT", "PRJ_APMD"): {"en": "APMD - Africa Pastoral Market Development", "fr": "APMD — Développement des marchés pastoraux en Afrique", "pt": "APMD — Desenvolvimento de mercados pastoris em África", "ar": "APMD — تنمية أسواق الرعي في أفريقيا"},
    ("PAID_PROJECT", "PRJ_AQBIOD"): {"en": "AQBIOD — Aquatic Biodiversity", "fr": "AQBIOD — Biodiversité aquatique", "pt": "AQBIOD — Biodiversidade aquática", "ar": "AQBIOD — التنوع البيولوجي المائي"},
    ("PAID_SECTOR", "SP_1"): {"en": "Agriculture", "fr": "Agriculture", "pt": "Agricultura", "ar": "الزراعة"},
    ("PAID_SECTOR", "SP_2"): {"en": "Environment", "fr": "Environnement", "pt": "Ambiente", "ar": "البيئة"},
    ("PAID_SECTOR", "SP_3"): {"en": "Fishery", "fr": "Pêche", "pt": "Pesca", "ar": "الصيد"},
    ("PAID_SECTOR", "SP_4"): {"en": "Forestry", "fr": "Sylviculture", "pt": "Silvicultura", "ar": "الغابات"},
    ("PAID_SECTOR", "SP_5"): {"en": "Land and Water", "fr": "Terre et eau", "pt": "Terra e água", "ar": "الأرض والمياه"},
    ("PAID_SECTOR", "SP_6"): {"en": "Livelihoods and cash", "fr": "Moyens de subsistance et cash", "pt": "Meios de subsistência e dinheiro", "ar": "سبل العيش والنقد"},
    ("PAID_SECTOR", "SP_7"): {"en": "Livestock", "fr": "Élevage", "pt": "Pecuária", "ar": "الثروة الحيوانية"},
    ("PAID_SECTOR", "SP_8"): {"en": "Nutrition and Human health", "fr": "Nutrition et santé humaine", "pt": "Nutrição e saúde humana", "ar": "التغذية وصحة الإنسان"},
    ("PAID_SECTOR", "SP_9"): {"en": "Social protection", "fr": "Protection sociale", "pt": "Proteção social", "ar": "الحماية الاجتماعية"},
}

def run(host, label, container):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username='arisadmin', password=SSH_PASS, timeout=15)
    print(f"\n=== {label} ===")

    sql_lines = []
    for (cat, code), tr in TRANSLATIONS.items():
        name_json = json.dumps(tr, ensure_ascii=False).replace("'", "''")
        sql_lines.append(
            f"UPDATE public.fishery_referentials SET name = '{name_json}'::jsonb WHERE category = '{cat}' AND code = '{code}';"
        )

    sql_lines.append("SELECT category, code, name->>'en' as en, name->>'fr' as fr, name->>'pt' as pt, name->>'ar' as ar FROM public.fishery_referentials WHERE is_active=true AND name->>'pt' != '' ORDER BY category, sort_order LIMIT 10;")

    sql = '\n'.join(sql_lines)

    sftp = c.open_sftp()
    with sftp.open('/tmp/tr.sql', 'w') as f:
        f.write(sql)
    sftp.close()

    stdin, stdout, stderr = c.exec_command(
        f"echo '{SSH_PASS}' | sudo -S docker cp /tmp/tr.sql {container}:/tmp/tr.sql && "
        f"echo '{SSH_PASS}' | sudo -S docker exec {container} psql -U aris -d aris -f /tmp/tr.sql 2>&1",
        timeout=60)
    out = stdout.read().decode()

    updates = out.count('UPDATE 1')
    print(f"  Updated: {updates} referentials")

    # Show sample
    for l in out.split('\n'):
        l = l.strip()
        if '|' in l and 'category' not in l and '---' not in l and '[sudo]' not in l:
            print(f"  {l}")
        if l.startswith('(') and 'row' in l:
            print(f"  {l}")
            break

    c.close()

run('10.202.101.148', 'STAGING', 'aris-stg-postgres')
run('10.202.101.185', 'PRODUCTION', 'aris-postgres')
print("\nDone!")
