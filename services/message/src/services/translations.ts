/**
 * translations.ts — i18n labels for email/SMS templates (EN, FR, PT, AR)
 *
 * Convention: keys are dot-separated, grouped by template name.
 * The {{t "key"}} Handlebars helper resolves them at render time
 * using the `locale` field in the template data context.
 */

export type Locale = 'en' | 'fr' | 'pt' | 'ar';

export const DEFAULT_LOCALE: Locale = 'en';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'fr', 'pt', 'ar'];

const labels: Record<string, Record<Locale, string>> = {
  // ── Base layout ──────────────────────────────────────────────
  'layout.title': {
    en: 'ARIS — Animal Resources Information System',
    fr: 'ARIS — Système d\'Information sur les Ressources Animales',
    pt: 'ARIS — Sistema de Informação sobre Recursos Animais',
    ar: 'ARIS — نظام معلومات الموارد الحيوانية',
  },
  'layout.subtitle': {
    en: 'African Union — Inter-African Bureau for Animal Resources (AU-IBAR)',
    fr: 'Union Africaine — Bureau Interafricain des Ressources Animales (UA-BIRA)',
    pt: 'União Africana — Escritório Interafricano de Recursos Animais (UA-BIRA)',
    ar: 'الاتحاد الأفريقي — المكتب الأفريقي المشترك للموارد الحيوانية',
  },
  'layout.preheader': {
    en: 'ARIS Notification — African Union Inter-African Bureau for Animal Resources',
    fr: 'Notification ARIS — Union Africaine Bureau Interafricain des Ressources Animales',
    pt: 'Notificação ARIS — União Africana Escritório Interafricano de Recursos Animais',
    ar: 'إشعار ARIS — الاتحاد الأفريقي المكتب الأفريقي المشترك للموارد الحيوانية',
  },
  'layout.automated_notice': {
    en: 'This is an automated notification from ARIS 4.0',
    fr: 'Ceci est une notification automatique d\'ARIS 4.0',
    pt: 'Esta é uma notificação automática do ARIS 4.0',
    ar: 'هذا إشعار آلي من ARIS 4.0',
  },
  'layout.unsubscribe': {
    en: 'Unsubscribe',
    fr: 'Se désabonner',
    pt: 'Cancelar inscrição',
    ar: 'إلغاء الاشتراك',
  },
  'layout.privacy': {
    en: 'Privacy Notice',
    fr: 'Politique de confidentialité',
    pt: 'Aviso de privacidade',
    ar: 'سياسة الخصوصية',
  },
  'layout.copyright': {
    en: 'AU-IBAR. All rights reserved.',
    fr: 'UA-BIRA. Tous droits réservés.',
    pt: 'UA-BIRA. Todos os direitos reservados.',
    ar: 'المكتب الأفريقي المشترك للموارد الحيوانية. جميع الحقوق محفوظة.',
  },

  // ── Welcome email ────────────────────────────────────────────
  'welcome.hero': {
    en: 'Welcome to ARIS',
    fr: 'Bienvenue sur ARIS',
    pt: 'Bem-vindo ao ARIS',
    ar: 'مرحبًا بك في ARIS',
  },
  'welcome.intro': {
    en: 'Your ARIS account has been created by an administrator. Use the credentials below to sign in for the first time. You will be prompted to set your own password before the application unlocks.',
    fr: 'Votre compte ARIS a été créé par un administrateur. Utilisez les identifiants ci-dessous pour vous connecter pour la première fois. Vous serez invité à définir votre propre mot de passe avant de pouvoir accéder à l\'application.',
    pt: 'A sua conta ARIS foi criada por um administrador. Utilize as credenciais abaixo para iniciar sessão pela primeira vez. Ser-lhe-á pedido que defina a sua própria palavra-passe antes de aceder à aplicação.',
    ar: 'تم إنشاء حسابك في ARIS بواسطة مسؤول. استخدم بيانات الاعتماد أدناه لتسجيل الدخول لأول مرة. سيُطلب منك تعيين كلمة مرور خاصة بك قبل فتح التطبيق.',
  },
  'welcome.credentials_title': {
    en: 'Your credentials',
    fr: 'Vos identifiants',
    pt: 'As suas credenciais',
    ar: 'بيانات الاعتماد الخاصة بك',
  },
  'welcome.credentials_warning': {
    en: 'Keep this email safe — the temporary password is shown only here',
    fr: 'Conservez cet email — le mot de passe temporaire n\'apparaît qu\'ici',
    pt: 'Guarde este email — a palavra-passe temporária só aparece aqui',
    ar: 'احتفظ بهذا البريد الإلكتروني — كلمة المرور المؤقتة تظهر هنا فقط',
  },
  'welcome.label_email': {
    en: 'Email',
    fr: 'E-mail',
    pt: 'E-mail',
    ar: 'البريد الإلكتروني',
  },
  'welcome.label_password': {
    en: 'Temporary password',
    fr: 'Mot de passe temporaire',
    pt: 'Palavra-passe temporária',
    ar: 'كلمة المرور المؤقتة',
  },
  'welcome.label_role': {
    en: 'Role',
    fr: 'Rôle',
    pt: 'Função',
    ar: 'الدور',
  },
  'welcome.label_organization': {
    en: 'Organization',
    fr: 'Organisation',
    pt: 'Organização',
    ar: 'المنظمة',
  },
  'welcome.password_change_title': {
    en: 'Password change required on first sign-in',
    fr: 'Changement de mot de passe obligatoire à la première connexion',
    pt: 'Alteração de palavra-passe obrigatória no primeiro início de sessão',
    ar: 'يجب تغيير كلمة المرور عند تسجيل الدخول الأول',
  },
  'welcome.password_change_body': {
    en: 'For security reasons, the ARIS platform will block access until you replace this temporary password with one of your own. Choose at least 8 characters, mixing letters and digits.',
    fr: 'Pour des raisons de sécurité, la plateforme ARIS bloquera l\'accès tant que vous n\'aurez pas remplacé ce mot de passe temporaire par le vôtre. Choisissez au moins 8 caractères, en mélangeant lettres et chiffres.',
    pt: 'Por razões de segurança, a plataforma ARIS bloqueará o acesso até substituir esta palavra-passe temporária pela sua. Escolha pelo menos 8 caracteres, misturando letras e dígitos.',
    ar: 'لأسباب أمنية، ستمنع منصة ARIS الوصول حتى تستبدل كلمة المرور المؤقتة بكلمة مرور خاصة بك. اختر 8 أحرف على الأقل، مع مزج الحروف والأرقام.',
  },
  'welcome.cta': {
    en: 'Sign in to ARIS',
    fr: 'Se connecter à ARIS',
    pt: 'Iniciar sessão no ARIS',
    ar: 'تسجيل الدخول إلى ARIS',
  },
  'welcome.next_steps': {
    en: 'Next steps',
    fr: 'Prochaines étapes',
    pt: 'Próximos passos',
    ar: 'الخطوات التالية',
  },
  'welcome.step1': {
    en: 'Sign in at',
    fr: 'Connectez-vous sur',
    pt: 'Inicie sessão em',
    ar: 'سجل الدخول على',
  },
  'welcome.step2': {
    en: 'Set a new password when prompted',
    fr: 'Définissez un nouveau mot de passe lorsque demandé',
    pt: 'Defina uma nova palavra-passe quando solicitado',
    ar: 'عيّن كلمة مرور جديدة عند الطلب',
  },
  'welcome.step3': {
    en: 'Enable multi-factor authentication (MFA) from your profile',
    fr: 'Activez l\'authentification multi-facteurs (MFA) depuis votre profil',
    pt: 'Ative a autenticação multifator (MFA) a partir do seu perfil',
    ar: 'فعّل المصادقة متعددة العوامل (MFA) من ملفك الشخصي',
  },
  'welcome.step4': {
    en: 'Review your campaigns, validations and domain data',
    fr: 'Consultez vos campagnes, validations et données de domaine',
    pt: 'Reveja as suas campanhas, validações e dados de domínio',
    ar: 'راجع حملاتك وعمليات التحقق وبيانات المجال',
  },
  'welcome.security_footer': {
    en: 'If you did not expect this invitation, please ignore this email — the account will remain locked until you sign in. Never share your password with anyone. AU-IBAR staff will never ask for it.',
    fr: 'Si vous n\'attendiez pas cette invitation, veuillez ignorer cet email — le compte restera verrouillé tant que vous ne vous serez pas connecté. Ne partagez jamais votre mot de passe. Le personnel de l\'UA-BIRA ne vous le demandera jamais.',
    pt: 'Se não esperava este convite, ignore este email — a conta permanecerá bloqueada até iniciar sessão. Nunca partilhe a sua palavra-passe com ninguém. Os funcionários do UA-BIRA nunca a pedirão.',
    ar: 'إذا لم تكن تتوقع هذه الدعوة، يرجى تجاهل هذا البريد الإلكتروني — سيبقى الحساب مقفلاً حتى تسجل الدخول. لا تشارك كلمة مرورك أبدًا مع أي شخص. لن يطلبها موظفو المكتب الأفريقي المشترك أبدًا.',
  },

  // ── Password reset ───────────────────────────────────────────
  'password_reset.intro': {
    en: 'We received a request to reset your password for ARIS.',
    fr: 'Nous avons reçu une demande de réinitialisation de votre mot de passe ARIS.',
    pt: 'Recebemos um pedido para redefinir a sua palavra-passe do ARIS.',
    ar: 'تلقينا طلبًا لإعادة تعيين كلمة المرور الخاصة بك في ARIS.',
  },
  'password_reset.action': {
    en: 'Click the button below to create a new password:',
    fr: 'Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :',
    pt: 'Clique no botão abaixo para criar uma nova palavra-passe:',
    ar: 'انقر على الزر أدناه لإنشاء كلمة مرور جديدة:',
  },
  'password_reset.cta': {
    en: 'Reset Password',
    fr: 'Réinitialiser le mot de passe',
    pt: 'Redefinir palavra-passe',
    ar: 'إعادة تعيين كلمة المرور',
  },
  'password_reset.expires': {
    en: 'This link expires in',
    fr: 'Ce lien expire dans',
    pt: 'Este link expira em',
    ar: 'تنتهي صلاحية هذا الرابط خلال',
  },
  'password_reset.security': {
    en: 'Security notice: If you did not request this, please ignore this email. Your password will remain unchanged.',
    fr: 'Avis de sécurité : Si vous n\'avez pas fait cette demande, veuillez ignorer cet email. Votre mot de passe restera inchangé.',
    pt: 'Aviso de segurança: Se não solicitou isto, ignore este email. A sua palavra-passe permanecerá inalterada.',
    ar: 'تنبيه أمني: إذا لم تطلب ذلك، يرجى تجاهل هذا البريد الإلكتروني. ستبقى كلمة مرورك دون تغيير.',
  },

  // ── New device login ─────────────────────────────────────────
  'device.greeting': {
    en: 'Hello',
    fr: 'Bonjour',
    pt: 'Olá',
    ar: 'مرحبًا',
  },
  'device.new_device_alert': {
    en: 'We noticed a login to your ARIS account from a <strong>new device</strong> that we do not recognise.',
    fr: 'Nous avons détecté une connexion à votre compte ARIS depuis un <strong>nouvel appareil</strong> que nous ne reconnaissons pas.',
    pt: 'Detetámos um início de sessão na sua conta ARIS a partir de um <strong>novo dispositivo</strong> que não reconhecemos.',
    ar: 'لاحظنا تسجيل دخول إلى حسابك في ARIS من <strong>جهاز جديد</strong> لا نتعرف عليه.',
  },
  'device.known_device_alert': {
    en: 'A new login to your ARIS account has been detected.',
    fr: 'Une nouvelle connexion à votre compte ARIS a été détectée.',
    pt: 'Foi detetado um novo início de sessão na sua conta ARIS.',
    ar: 'تم اكتشاف تسجيل دخول جديد إلى حسابك في ARIS.',
  },
  'device.login_details': {
    en: 'Login Details',
    fr: 'Détails de connexion',
    pt: 'Detalhes de acesso',
    ar: 'تفاصيل تسجيل الدخول',
  },
  'device.label_device': {
    en: 'Device',
    fr: 'Appareil',
    pt: 'Dispositivo',
    ar: 'الجهاز',
  },
  'device.label_type': {
    en: 'Type',
    fr: 'Type',
    pt: 'Tipo',
    ar: 'النوع',
  },
  'device.label_ip': {
    en: 'IP Address',
    fr: 'Adresse IP',
    pt: 'Endereço IP',
    ar: 'عنوان IP',
  },
  'device.label_datetime': {
    en: 'Date & Time',
    fr: 'Date et heure',
    pt: 'Data e hora',
    ar: 'التاريخ والوقت',
  },
  'device.security_warning': {
    en: 'Security Notice: If you did not perform this login, your account may be compromised. Please change your password immediately and contact your system administrator.',
    fr: 'Avis de sécurité : Si vous n\'avez pas effectué cette connexion, votre compte pourrait être compromis. Veuillez changer votre mot de passe immédiatement et contacter votre administrateur.',
    pt: 'Aviso de segurança: Se não efetuou este acesso, a sua conta pode estar comprometida. Altere a sua palavra-passe imediatamente e contacte o administrador do sistema.',
    ar: 'تنبيه أمني: إذا لم تقم بتسجيل الدخول هذا، فقد يكون حسابك مخترقًا. يرجى تغيير كلمة المرور فورًا والاتصال بمسؤول النظام.',
  },
  'device.action_hint': {
    en: 'If this was you, no action is required. If it was not you, secure your account immediately:',
    fr: 'Si c\'était vous, aucune action n\'est requise. Sinon, sécurisez votre compte immédiatement :',
    pt: 'Se foi você, nenhuma ação é necessária. Caso contrário, proteja a sua conta imediatamente:',
    ar: 'إذا كنت أنت، فلا حاجة لأي إجراء. إذا لم تكن أنت، قم بتأمين حسابك فورًا:',
  },
  'device.cta': {
    en: 'Secure My Account',
    fr: 'Sécuriser mon compte',
    pt: 'Proteger a minha conta',
    ar: 'تأمين حسابي',
  },
  'device.multi_session_info': {
    en: 'Information: Your organisation allows simultaneous connections on multiple devices. You will receive this notification for every login to keep you informed of account activity.',
    fr: 'Information : Votre organisation autorise les connexions simultanées sur plusieurs appareils. Vous recevrez cette notification à chaque connexion pour vous tenir informé de l\'activité de votre compte.',
    pt: 'Informação: A sua organização permite ligações simultâneas em vários dispositivos. Receberá esta notificação a cada início de sessão para o manter informado da atividade da conta.',
    ar: 'معلومة: تسمح منظمتك بالاتصالات المتزامنة على أجهزة متعددة. ستتلقى هذا الإشعار لكل تسجيل دخول لإبقائك على اطلاع بنشاط الحساب.',
  },

  // ── Workflow approved ────────────────────────────────────────
  'workflow.dear_user': {
    en: 'Dear User,',
    fr: 'Cher utilisateur,',
    pt: 'Caro utilizador,',
    ar: 'عزيزي المستخدم،',
  },
  'workflow.approved_msg': {
    en: 'has been approved at',
    fr: 'a été approuvé(e) au',
    pt: 'foi aprovado(a) no',
    ar: 'تمت الموافقة عليه في',
  },
  'workflow.level': {
    en: 'Level',
    fr: 'Niveau',
    pt: 'Nível',
    ar: 'المستوى',
  },
  'workflow.approver_note': {
    en: 'Approver\'s note',
    fr: 'Note de l\'approbateur',
    pt: 'Nota do aprovador',
    ar: 'ملاحظة المعتمد',
  },
  'workflow.wahis_ready': {
    en: 'WAHIS Ready',
    fr: 'Prêt pour WAHIS',
    pt: 'Pronto para WAHIS',
    ar: 'جاهز لـ WAHIS',
  },
  'workflow.analytics_ready': {
    en: 'Analytics Ready',
    fr: 'Prêt pour l\'analyse',
    pt: 'Pronto para análise',
    ar: 'جاهز للتحليلات',
  },
  'workflow.view_dashboard': {
    en: 'View in Dashboard',
    fr: 'Voir dans le tableau de bord',
    pt: 'Ver no painel',
    ar: 'عرض في لوحة المعلومات',
  },

  // ── Workflow rejected ────────────────────────────────────────
  'workflow.rejected_msg': {
    en: 'has been rejected at',
    fr: 'a été rejeté(e) au',
    pt: 'foi rejeitado(a) no',
    ar: 'تم رفضه في',
  },
  'workflow.reason': {
    en: 'Reason',
    fr: 'Motif',
    pt: 'Motivo',
    ar: 'السبب',
  },
  'workflow.review_correct': {
    en: 'Review & Correct',
    fr: 'Vérifier et corriger',
    pt: 'Rever e corrigir',
    ar: 'مراجعة وتصحيح',
  },

  // ── Quality failed ───────────────────────────────────────────
  'quality.dear_steward': {
    en: 'Dear Data Steward,',
    fr: 'Cher responsable des données,',
    pt: 'Caro responsável de dados,',
    ar: 'عزيزي مسؤول البيانات،',
  },
  'quality.failed_msg': {
    en: 'failed quality gate(s).',
    fr: 'n\'a pas passé le(s) contrôle(s) de qualité.',
    pt: 'falhou no(s) controlo(s) de qualidade.',
    ar: 'لم يجتز بوابة (بوابات) الجودة.',
  },
  'quality.rule': {
    en: 'Rule',
    fr: 'Règle',
    pt: 'Regra',
    ar: 'القاعدة',
  },
  'quality.message': {
    en: 'Message',
    fr: 'Message',
    pt: 'Mensagem',
    ar: 'الرسالة',
  },
  'quality.view_report': {
    en: 'View Full Report',
    fr: 'Voir le rapport complet',
    pt: 'Ver relatório completo',
    ar: 'عرض التقرير الكامل',
  },
  'quality.correct_record': {
    en: 'Correct Record',
    fr: 'Corriger l\'enregistrement',
    pt: 'Corrigir registo',
    ar: 'تصحيح السجل',
  },

  // ── Correction overdue ───────────────────────────────────────
  'correction.escalation': {
    en: 'ESCALATION',
    fr: 'ESCALADE',
    pt: 'ESCALAÇÃO',
    ar: 'تصعيد',
  },
  'correction.overdue_msg': {
    en: 'days overdue',
    fr: 'jours de retard',
    pt: 'dias de atraso',
    ar: 'أيام تأخير',
  },
  'correction.original_deadline': {
    en: 'Original deadline',
    fr: 'Date limite initiale',
    pt: 'Prazo original',
    ar: 'الموعد النهائي الأصلي',
  },
  'correction.escalated_notice': {
    en: 'This matter has been escalated. Please take immediate action.',
    fr: 'Cette affaire a été escaladée. Veuillez agir immédiatement.',
    pt: 'Este assunto foi escalado. Por favor, tome medidas imediatas.',
    ar: 'تم تصعيد هذه المسألة. يرجى اتخاذ إجراء فوري.',
  },
  'correction.take_action': {
    en: 'Take Action Now',
    fr: 'Agir maintenant',
    pt: 'Agir agora',
    ar: 'اتخذ إجراءً الآن',
  },

  // ── Campaign assigned ────────────────────────────────────────
  'campaign.greeting': {
    en: 'Dear',
    fr: 'Cher/Chère',
    pt: 'Caro/Cara',
    ar: 'عزيزي/عزيزتي',
  },
  'campaign.assigned_msg': {
    en: 'You have been assigned to a new data collection campaign.',
    fr: 'Vous avez été assigné(e) à une nouvelle campagne de collecte de données.',
    pt: 'Foi-lhe atribuída uma nova campanha de recolha de dados.',
    ar: 'تم تعيينك لحملة جمع بيانات جديدة.',
  },
  'campaign.details_title': {
    en: 'Campaign Details',
    fr: 'Détails de la campagne',
    pt: 'Detalhes da campanha',
    ar: 'تفاصيل الحملة',
  },
  'campaign.label_name': {
    en: 'Name',
    fr: 'Nom',
    pt: 'Nome',
    ar: 'الاسم',
  },
  'campaign.label_domain': {
    en: 'Domain',
    fr: 'Domaine',
    pt: 'Domínio',
    ar: 'المجال',
  },
  'campaign.label_period': {
    en: 'Period',
    fr: 'Période',
    pt: 'Período',
    ar: 'الفترة',
  },
  'campaign.label_zones': {
    en: 'Target Zones',
    fr: 'Zones cibles',
    pt: 'Zonas alvo',
    ar: 'المناطق المستهدفة',
  },
  'campaign.all_zones': {
    en: 'All zones',
    fr: 'Toutes les zones',
    pt: 'Todas as zonas',
    ar: 'جميع المناطق',
  },
  'campaign.view': {
    en: 'View Campaign',
    fr: 'Voir la campagne',
    pt: 'Ver campanha',
    ar: 'عرض الحملة',
  },

  // ── Domain alert ─────────────────────────────────────────────
  'alert.critical': {
    en: 'CRITICAL ALERT',
    fr: 'ALERTE CRITIQUE',
    pt: 'ALERTA CRÍTICO',
    ar: 'تنبيه حرج',
  },
  'alert.outbreak_msg': {
    en: 'outbreak has been reported in',
    fr: 'un foyer a été signalé en/au',
    pt: 'foi reportado um surto em',
    ar: 'تم الإبلاغ عن تفشٍّ في',
  },
  'alert.label_disease': {
    en: 'Disease',
    fr: 'Maladie',
    pt: 'Doença',
    ar: 'المرض',
  },
  'alert.label_country': {
    en: 'Country',
    fr: 'Pays',
    pt: 'País',
    ar: 'البلد',
  },
  'alert.label_severity': {
    en: 'Severity',
    fr: 'Gravité',
    pt: 'Gravidade',
    ar: 'الخطورة',
  },
  'alert.label_reported_date': {
    en: 'Reported Date',
    fr: 'Date de signalement',
    pt: 'Data de reporte',
    ar: 'تاريخ الإبلاغ',
  },
  'alert.label_cases': {
    en: 'Cases',
    fr: 'Cas',
    pt: 'Casos',
    ar: 'الحالات',
  },
  'alert.label_deaths': {
    en: 'Deaths',
    fr: 'Décès',
    pt: 'Mortes',
    ar: 'الوفيات',
  },
  'alert.view_map': {
    en: 'View on Map',
    fr: 'Voir sur la carte',
    pt: 'Ver no mapa',
    ar: 'عرض على الخريطة',
  },
  'alert.view_event': {
    en: 'View Event Details',
    fr: 'Voir les détails de l\'événement',
    pt: 'Ver detalhes do evento',
    ar: 'عرض تفاصيل الحدث',
  },

  // ── Daily digest ─────────────────────────────────────────────
  'digest.greeting': {
    en: 'Good morning',
    fr: 'Bonjour',
    pt: 'Bom dia',
    ar: 'صباح الخير',
  },
  'digest.pending_approvals': {
    en: 'Pending Approvals',
    fr: 'Approbations en attente',
    pt: 'Aprovações pendentes',
    ar: 'الموافقات المعلقة',
  },
  'digest.overdue_corrections': {
    en: 'Overdue Corrections',
    fr: 'Corrections en retard',
    pt: 'Correções em atraso',
    ar: 'التصحيحات المتأخرة',
  },
  'digest.unread_notifications': {
    en: 'Unread Notifications',
    fr: 'Notifications non lues',
    pt: 'Notificações não lidas',
    ar: 'الإشعارات غير المقروءة',
  },
  'digest.top_pending': {
    en: 'Top Pending Items',
    fr: 'Éléments en attente prioritaires',
    pt: 'Itens pendentes prioritários',
    ar: 'العناصر المعلقة الأهم',
  },
  'digest.col_type': {
    en: 'Type',
    fr: 'Type',
    pt: 'Tipo',
    ar: 'النوع',
  },
  'digest.col_ref': {
    en: 'Ref',
    fr: 'Réf',
    pt: 'Ref',
    ar: 'المرجع',
  },
  'digest.col_level': {
    en: 'Level',
    fr: 'Niveau',
    pt: 'Nível',
    ar: 'المستوى',
  },
  'digest.col_due_date': {
    en: 'Due Date',
    fr: 'Date limite',
    pt: 'Data limite',
    ar: 'تاريخ الاستحقاق',
  },
  'digest.go_dashboard': {
    en: 'Go to Dashboard',
    fr: 'Aller au tableau de bord',
    pt: 'Ir para o painel',
    ar: 'الذهاب إلى لوحة المعلومات',
  },

  // ── Common / shared labels ───────────────────────────────────
  'common.ref': {
    en: 'Ref',
    fr: 'Réf',
    pt: 'Ref',
    ar: 'المرجع',
  },
  'common.record': {
    en: 'Record',
    fr: 'Enregistrement',
    pt: 'Registo',
    ar: 'السجل',
  },
};

/**
 * Resolve a label key for the given locale.
 * Falls back: requested locale → en → key itself.
 */
export function translate(key: string, locale: Locale | string): string {
  const entry = labels[key];
  if (!entry) return key;
  const loc = (locale || 'en') as Locale;
  return entry[loc] ?? entry['en'] ?? key;
}

/**
 * Get the text direction for a locale.
 */
export function textDirection(locale: Locale | string): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Email subjects per locale per event type.
 */
export const EMAIL_SUBJECTS_I18N: Record<string, Record<Locale, string>> = {
  WELCOME: {
    en: '[ARIS] Welcome to ARIS',
    fr: '[ARIS] Bienvenue sur ARIS',
    pt: '[ARIS] Bem-vindo ao ARIS',
    ar: '[ARIS] مرحبًا بك في ARIS',
  },
  PASSWORD_RESET: {
    en: '[ARIS] Password Reset Request',
    fr: '[ARIS] Demande de réinitialisation du mot de passe',
    pt: '[ARIS] Pedido de redefinição de palavra-passe',
    ar: '[ARIS] طلب إعادة تعيين كلمة المرور',
  },
  NEW_DEVICE_LOGIN: {
    en: '[ARIS] ⚠️ New login on your account — {{deviceName}}',
    fr: '[ARIS] ⚠️ Nouvelle connexion sur votre compte — {{deviceName}}',
    pt: '[ARIS] ⚠️ Novo início de sessão na sua conta — {{deviceName}}',
    ar: '[ARIS] ⚠️ تسجيل دخول جديد على حسابك — {{deviceName}}',
  },
  WORKFLOW_APPROVED: {
    en: '[ARIS] {{entityType}} Approved — Level {{level}}',
    fr: '[ARIS] {{entityType}} approuvé(e) — Niveau {{level}}',
    pt: '[ARIS] {{entityType}} aprovado(a) — Nível {{level}}',
    ar: '[ARIS] تمت الموافقة على {{entityType}} — المستوى {{level}}',
  },
  WORKFLOW_REJECTED: {
    en: '[ARIS] {{entityType}} Rejected — Level {{level}}',
    fr: '[ARIS] {{entityType}} rejeté(e) — Niveau {{level}}',
    pt: '[ARIS] {{entityType}} rejeitado(a) — Nível {{level}}',
    ar: '[ARIS] تم رفض {{entityType}} — المستوى {{level}}',
  },
  CAMPAIGN_ASSIGNED: {
    en: '[ARIS] Campaign Assigned — {{campaignName}}',
    fr: '[ARIS] Campagne assignée — {{campaignName}}',
    pt: '[ARIS] Campanha atribuída — {{campaignName}}',
    ar: '[ARIS] تم تعيين حملة — {{campaignName}}',
  },
  QUALITY_FAILED: {
    en: '[ARIS] Quality Check Failed — {{entityType}}',
    fr: '[ARIS] Contrôle de qualité échoué — {{entityType}}',
    pt: '[ARIS] Controlo de qualidade falhado — {{entityType}}',
    ar: '[ARIS] فشل فحص الجودة — {{entityType}}',
  },
  CORRECTION_OVERDUE: {
    en: '[ARIS] ESCALATION — Overdue Correction ({{daysOverdue}} days)',
    fr: '[ARIS] ESCALADE — Correction en retard ({{daysOverdue}} jours)',
    pt: '[ARIS] ESCALAÇÃO — Correção em atraso ({{daysOverdue}} dias)',
    ar: '[ARIS] تصعيد — تصحيح متأخر ({{daysOverdue}} أيام)',
  },
  DAILY_DIGEST: {
    en: '[ARIS] Daily Summary — {{date}}',
    fr: '[ARIS] Résumé quotidien — {{date}}',
    pt: '[ARIS] Resumo diário — {{date}}',
    ar: '[ARIS] ملخص يومي — {{date}}',
  },
  ALERT_NEW: {
    en: '[ARIS] New Event Reported — {{domain}}: {{title}}',
    fr: '[ARIS] Nouvel événement signalé — {{domain}} : {{title}}',
    pt: '[ARIS] Novo evento reportado — {{domain}}: {{title}}',
    ar: '[ARIS] تم الإبلاغ عن حدث جديد — {{domain}}: {{title}}',
  },
  ALERT_CONFIRMED: {
    en: '[ARIS] Event Confirmed — {{domain}}: {{title}}',
    fr: '[ARIS] Événement confirmé — {{domain}} : {{title}}',
    pt: '[ARIS] Evento confirmado — {{domain}}: {{title}}',
    ar: '[ARIS] تم تأكيد الحدث — {{domain}}: {{title}}',
  },
  ALERT_REGIONAL: {
    en: '[ARIS] REGIONAL ALERT — {{domain}}: {{title}}',
    fr: '[ARIS] ALERTE RÉGIONALE — {{domain}} : {{title}}',
    pt: '[ARIS] ALERTA REGIONAL — {{domain}}: {{title}}',
    ar: '[ARIS] تنبيه إقليمي — {{domain}}: {{title}}',
  },
};
