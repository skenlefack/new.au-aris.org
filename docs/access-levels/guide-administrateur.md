# Niveaux d'accès par domaine — Guide administrateur

**Version :** 1.0
**Date :** 2026-09-25

---

## 1. Qu'est-ce qu'un niveau d'accès ?

Un **niveau d'accès** est un label que vous attachez a un domaine (ex: Sante animale) ou a un sous-domaine (ex: PPR). Il permet de filtrer les campagnes de collecte : seuls les utilisateurs qui possedent le bon niveau verront la campagne.

**Exemples de niveaux :**
- `TERRAIN` — Agents de collecte sur le terrain
- `LABORATOIRE` — Personnel de laboratoire
- `ENCADREMENT` — Superviseurs et coordinateurs
- `EPIDEMIOLOGIE` — Epidemiologistes

---

## 2. Principes de base

### Pas d'heritage
Les niveaux d'un domaine ne s'appliquent **qu'a ce domaine**. Etre affecte au domaine "Sante animale" avec le niveau `TERRAIN` ne donne pas acces aux campagnes du sous-domaine "PPR", et inversement.

### Campagne ouverte
Si aucun niveau n'est selectionne sur un domaine lors de la creation d'une campagne, celle-ci est **ouverte** : tous les utilisateurs ayant acces au domaine la voient.

### Retrocompatibilite
Toutes les campagnes existantes n'ont aucun niveau configure. Elles restent donc visibles exactement comme avant.

### Desactivation, pas suppression
Un niveau deja utilise peut etre **desactive** mais jamais supprime. Les affectations existantes restent lisibles mais le niveau n'apparait plus dans les formulaires.

---

## 3. Configurer les niveaux d'acces

### Acces a la page
1. Allez dans **Settings** (engrenage)
2. Dans le groupe **Data & Domains**, cliquez sur **Access Levels**

### Creer un niveau
1. Dans l'arbre de gauche, selectionnez le domaine ou sous-domaine cible
2. Cliquez sur **Add Level**
3. Renseignez :
   - **Code** : identifiant unique en MAJUSCULES (ex: `TERRAIN`). Immuable apres creation.
   - **Labels** : nom dans les 4 langues (EN, FR, AR, PT). Tous obligatoires.
   - **Description** : optionnelle, en anglais
4. Cliquez sur **Create**

### Modifier un niveau
1. Survolez le niveau dans la liste
2. Cliquez sur l'icone crayon
3. Modifiez les labels ou la description (le code est immuable)
4. Cliquez sur **Save**

### Reordonner les niveaux
Utilisez les fleches haut/bas pour changer l'ordre d'affichage.

### Desactiver un niveau
1. Cliquez sur l'icone d'interdiction (cercle barre)
2. Confirmez dans la boite de dialogue
3. Le niveau apparait avec un badge "Inactive"

### Copier les niveaux d'un autre noeud
1. Selectionnez le noeud cible (qui doit recevoir les niveaux)
2. Cliquez sur **Copy from...**
3. Selectionnez le noeud source
4. Les niveaux sont copies. Les doublons (meme code) sont ignores.
5. Les copies sont independantes : modifier l'un ne modifie pas l'autre.

---

## 4. Affecter des niveaux a un utilisateur

1. Allez dans **Settings > Users**
2. Editez l'utilisateur
3. Dans la section **Domains**, cochez les domaines souhaites
4. Si des niveaux existent sur les domaines coches, une section **Access Levels** apparait
5. Pour chaque domaine, cliquez sur les niveaux a attribuer (boutons toggle)
6. Sauvegardez l'utilisateur

**Note :** Si aucun niveau n'est selectionne sur un domaine, l'utilisateur ne verra que les campagnes **ouvertes** sur ce domaine.

---

## 5. Cibler une campagne avec des niveaux

1. Lors de la creation d'une campagne, apres avoir selectionne les domaines
2. Si des niveaux existent, une section **Access Levels** apparait sous les sous-domaines
3. Pour chaque domaine, selectionnez les niveaux concernes
4. Laisser vide = campagne ouverte a tous les utilisateurs du domaine

---

## 6. Qui contourne le filtre ?

| Role | Contourne ? |
|------|------------|
| Super Administrateur | Oui |
| Administrateur Continental | Oui |
| Administrateur REC | Non |
| Administrateur National | Non |
| Autres roles | Non |
| Agent affecte a la campagne | Oui (toujours) |

---

## 7. Bonnes pratiques

### Nommage des niveaux
- Utilisez des codes courts et explicites : `TERRAIN`, `LABO`, `EPIDEMIO`, `ENCADREMENT`
- Gardez le meme vocabulaire entre domaines similaires
- Utilisez **Copier depuis** pour harmoniser entre domaines

### Nombre de niveaux
- 3 a 7 niveaux par domaine est ideal
- Trop de niveaux complexifie l'administration
- Trop peu rend le filtrage inutile

### Migration progressive
1. Commencez par un seul domaine pilote
2. Creez les niveaux, affectez-les aux utilisateurs
3. Configurez les nouvelles campagnes avec des niveaux
4. Verifiez que les utilisateurs voient bien les bonnes campagnes
5. Etendez aux autres domaines

### Campagnes existantes
Les campagnes deja creees n'ont pas de niveaux et restent ouvertes. Si vous souhaitez les restreindre, editez-les pour ajouter des niveaux.

---

## 8. Depannage

| Probleme | Cause probable | Solution |
|----------|---------------|----------|
| L'utilisateur ne voit pas une campagne | Pas le bon niveau sur le domaine | Verifier ses niveaux dans Settings > Users |
| La section Access Levels n'apparait pas | Aucun niveau configure sur les domaines | Creer des niveaux dans Settings > Access Levels |
| Un niveau desactive apparait encore | Cache navigateur | Rafraichir la page |
| Campagnes existantes disparues | Niveaux ajoutes a la campagne sans verifier les utilisateurs | Retirer les niveaux de la campagne (la rendre ouverte) ou affecter les niveaux aux utilisateurs |

---

## 9. Feature flag

Le filtrage est controle par la variable d'environnement `ACCESS_LEVELS_ENABLED`.

- **`false`** (defaut) : le filtrage n'est pas actif, tous les utilisateurs voient toutes les campagnes comme avant
- **`true`** : le filtrage est actif

Le flag peut etre active/desactive sans migration de base de donnees. Les niveaux, affectations et scopes de campagnes restent en base et sont simplement ignores quand le flag est desactive.
