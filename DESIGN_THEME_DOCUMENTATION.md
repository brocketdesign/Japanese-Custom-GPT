# 🎨 Guide du Thème Visuel et Design - Japanese Custom GPT

## 📋 Table des Matières
1. [Vue d'ensemble du Design](#vue-densemble-du-design)
2. [Palette de Couleurs](#palette-de-couleurs)
3. [Typographie](#typographie)
4. [Éléments Visuels](#éléments-visuels)
5. [Composants d'Interface](#composants-dinterface)
6. [Animations et Interactions](#animations-et-interactions)
7. [Design Responsive](#design-responsive)
8. [Système de Thématisation](#système-de-thématisation)
9. [Accessibilité](#accessibilité)

---

## 🎯 Vue d'ensemble du Design

L'application **Japanese Custom GPT** adopte un design moderne et élégant avec une approche **glassmorphisme** et des éléments futuristes. Le thème principal s'articule autour de **gradients violets sophistiqués** combinés à des **interfaces translucides** pour créer une expérience utilisateur immersive et professionnelle.

### Philosophie Design
- **Minimalisme fonctionnel** : Interface épurée avec focus sur l'essentiel
- **Esthétique moderne** : Utilisation de dégradés, transparences et ombres subtiles
- **Expérience fluide** : Animations douces et transitions harmonieuses
- **Accessibilité inclusive** : Support des modes clairs/sombres et adaptabilité

---

## 🎨 Palette de Couleurs

### Couleurs Primaires

#### 💜 Violet Principal
```css
/* Gradient signature */
background: linear-gradient(90.9deg, #D2B8FF 2.74%, #8240FF 102.92%);

/* Variantes */
- Violet clair : #D2B8FF
- Violet principal : #8240FF / #6E20F4
- Violet foncé : #5a1acc / #7a42e0
- Violet accent : #9e7dde
```

#### 🌈 Gradients Spécialisés
```css
/* Premium/Principal */
Premium: linear-gradient(90.9deg, #D2B8FF 2.74%, #8240FF 102.92%)

/* Standard */
Standard: linear-gradient(90.9deg, #B8D2FF 2.74%, #4080FF 102.92%)

/* Basic */
Basic: linear-gradient(90.9deg, #B8FFF0 2.74%, #40BFF2 102.92%)

/* OneDay */
OneDay: linear-gradient(90.9deg, #FFD6B8 2.74%, #FF8C40 102.92%)

/* Danger */
Danger: linear-gradient(90.9deg, #F9B8FF 2.74%, #FF4040 102.92%)
```

### Couleurs Secondaires

#### 🖤 Palette Neutre
```css
- Noir principal : #1a1a1a, #2d2d2d
- Gris foncé : #4d5154, #495057
- Gris moyen : #6c757d, #8d8b8b
- Gris clair : #aeb0b4, #dddedf
- Blanc : #ffffff, #f8f9fa
```

#### 🌈 Couleurs Fonctionnelles
```css
- Succès : #28a745
- Attention : #ffc107, #f59e0b
- Erreur : #dc3545, #ef4444
- Information : #007bff
```

---

## ✍️ Typographie

### Police Principale
```css
@font-face {
    font-family: 'Inter';
    src: url(/fonts/Inter-VariableFont_opsz,wght.ttf) format("ttf");
    font-weight: 400;
    font-style: normal;
}

body {
    font-family: 'Inter', sans-serif;
}
```

### Hiérarchie Typographique
- **Titres principaux** : `u-color-grad` avec gradient textuel
- **Titres secondaires** : Font-weight 600-700
- **Corps de texte** : Font-size 14-16px, line-height 1.5
- **Texte secondaire** : Font-size 12-13px, couleur `#8d8b8b`
- **Labels** : Font-size 12px, couleur `#aaa`

---

## 🎭 Éléments Visuels

### Effets de Transparence et Blur
```css
/* Glassmorphisme */
background: rgba(255, 255, 255, 0.7);
backdrop-filter: blur(10px);
-webkit-backdrop-filter: blur(10px);

/* Overlays */
background: rgba(0, 0, 0, 0.7);
backdrop-filter: blur(8px);
```

### Système de Bordures
- **Border-radius standard** : `8px`, `12px`, `15px`
- **Border-radius complet** : `50%` pour les avatars
- **Border-radius spéciaux** : `25px`, `40px` pour les éléments premium

### Ombres et Profondeur
```css
/* Ombre subtile */
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

/* Ombre moyenne */
box-shadow: 0 4px 15px rgba(110, 32, 244, 0.15);

/* Ombre prononcée */
box-shadow: 0 8px 32px rgba(110, 32, 244, 0.15), 0 1.5px 8px rgba(0,0,0,0.08);

/* Ombre premium */
box-shadow: 0 15px 30px rgba(110, 32, 244, 0.2);
```

---

## 🧩 Composants d'Interface

### Boutons

#### 🔴 Bouton Principal (Gradient)
```css
.custom-gradient-bg {
    background: linear-gradient(90.9deg, #D2B8FF 2.74%, #8240FF 102.92%);
    color: #fff;
    border: none;
    border-radius: 15px;
    transition: all 0.3s ease;
}

.custom-gradient-bg:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}
```

#### ⚪ Bouton Outline
```css
.custom-gradient-bg-outline {
    background: transparent;
    color: #8240FF;
    border: 2px solid #8240FF;
    transition: all 0.3s ease;
}
```

### Cartes et Conteneurs

#### 🎴 Cartes Standard
```css
.card {
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.08);
    transition: all 0.3s ease;
}

.card:hover {
    transform: translateY(-8px) scale(1.01);
    box-shadow: 0 15px 30px rgba(110, 32, 244, 0.2);
}
```

#### 🌟 Cartes Premium
```css
.character-create-card {
    background: linear-gradient(145deg, #ffffff, #f0f0f0);
    border-radius: 15px;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.character-create-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 15px 30px rgba(110, 32, 244, 0.15);
    background: linear-gradient(145deg, #ffffff, #f5f5ff);
}
```

### Formulaires et Contrôles

#### 📝 Champs de Saisie
```css
.form-control {
    border: 1px solid #eef0f3;
    border-radius: 0.25rem;
    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.form-control:focus {
    border-color: #6E20F4;
    box-shadow: 0 0 0 3px rgba(110, 32, 244, 0.1);
}
```

#### 🎚️ Switches et Toggles
```css
.settings-switch {
    width: 65px;
    height: 30px;
}

.settings-switch input:checked + .settings-switch-slider {
    background: linear-gradient(135deg, #6E20F4 0%, #8B4CF8 100%);
    box-shadow: 0 4px 15px rgba(110, 32, 244, 0.2);
}
```

---

## ✨ Animations et Interactions

### Animations CSS Personnalisées

#### 🌊 Loading Circle
```css
@keyframes loadingRotate {
    0% { transform: translate(-50%, -50%) rotate(0deg); }
    100% { transform: translate(-50%, -50%) rotate(360deg); }
}

.loading-circle {
    background: conic-gradient(from 0deg, #D2B8FF 0deg, #8240FF 90deg, #D2B8FF 180deg);
    animation: loadingRotate 2s linear infinite;
}
```

#### 💫 Pulse et Float
```css
@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
}

@keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
}
```

### Transitions Standard
- **Durée standard** : `0.3s ease`
- **Transitions premium** : `0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)`
- **Micro-interactions** : `0.15s ease-in-out`

### Effets Hover
```css
/* Élévation standard */
:hover {
    transform: translateY(-2px);
    box-shadow: enhanced;
}

/* Élévation premium */
.premium:hover {
    transform: translateY(-8px) scale(1.03);
}

/* Rotation et scale */
.character-create-card:hover {
    transform: scale(1.12) rotate(5deg);
}
```

---

## 📱 Design Responsive

### Breakpoints
```css
/* Mobile */
@media (max-width: 600px) { /* Styles mobile */ }

/* Tablet */
@media (max-width: 768px) { /* Styles tablet */ }

/* Desktop */
@media (max-width: 1200px) { /* Styles desktop */ }
```

### Adaptations Mobile
- **Sidebar** : Transformation en overlay
- **Navigation** : Toolbar flottant en bas d'écran
- **Cards** : Adaptation de la grille et des espacements
- **Typography** : Réduction proportionnelle des tailles

### Footer Toolbar Mobile
```css
#footer-toolbar {
    position: fixed;
    bottom: 1rem;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(10px);
    border-radius: 32.5px;
    height: 65px;
}
```

---

## 🎯 Système de Thématisation

### Mode SFW/NSFW
```css
/* Mode SFW - Cache le contenu NSFW */
body.sfw-mode .nsfw-content {
    display: none !important;
}

/* Mode NSFW - Affiche le contenu NSFW */
body.nsfw-mode .nsfw-content {
    display: block;
}
```

### Classes d'État
- `.active` : État actif avec couleur primary
- `.selected` : État sélectionné avec bordure
- `.disabled` : État désactivé avec opacité réduite
- `.loading` : État de chargement avec spinner
- `.premium` : Indicateur premium avec styling spécial

### Indicateurs Visuels
```css
/* Badge Premium */
.popular-badge {
    background: linear-gradient(45deg, #FF5E7E, #FF8C40);
    transform: rotate(3deg);
    box-shadow: 0 4px 12px rgba(255, 94, 126, 0.35);
}

/* Badge NSFW */
.nsfw-badge-container {
    background: linear-gradient(to right, red, #ff4d4d, #f99);
    opacity: 0.5;
}
```

---

## ♿ Accessibilité

### Contraste et Lisibilité
- **Contraste minimum** : Respect des standards WCAG 2.1 AA
- **Focus visible** : Outline clara sur tous les éléments interactifs
- **Tailles de touch targets** : Minimum 44px sur mobile

### Animations Respectueuses
- **Reduced motion** : Support des préférences utilisateur
- **Durées modérées** : Pas d'animations trop longues
- **Options de désactivation** : Possibilité de réduire les animations

### Navigation
- **Navigation clavier** : Support complet
- **Screen readers** : Labels appropriés et structure sémantique
- **Focus management** : Gestion correcte du focus dans les modales

---

## 🚀 Bonnes Pratiques d'Implémentation

### Performance
- **GPU Acceleration** : `will-change: transform` sur les animations
- **Efficient transitions** : Utilisation de `transform` et `opacity`
- **Lazy loading** : Chargement différé des éléments coûteux

### Maintenabilité
- **Variables CSS** : Utilisation pour les couleurs récurrentes
- **Classes utilitaires** : Système modulaire et réutilisable
- **Documentation inline** : Commentaires explicatifs dans le CSS

### Évolutivité
- **Système de grille** : Bootstrap-based mais personnalisé
- **Composants modulaires** : Architecture en blocs réutilisables
- **Thème extensions** : Préparation pour de nouveaux thèmes

---

## 📊 Métriques et Standards

### Tailles Standards
- **Avatars** : 35px (small), 70px (medium), 110px (large)
- **Boutons** : 44px minimum height pour mobile
- **Cartes** : 15px border-radius standard
- **Espacements** : Multiples de 4px (8px, 12px, 16px, 20px, 24px)

### Z-Index Hierarchy
```css
z-index: 1;     /* Base content */
z-index: 10;    /* Floating elements */
z-index: 1020;  /* Sticky elements */
z-index: 1030;  /* Toolbars */
z-index: 1034;  /* Sidebars */
z-index: 1050;  /* Overlays */
z-index: 1060;  /* Modals */
z-index: 10000; /* Critical modals */
```

---

## 🔮 Évolutions Futures

### Améliorations Prévues
1. **Dark Mode** complet avec palette dédiée
2. **Thèmes personnalisables** par l'utilisateur
3. **Animations avancées** avec GSAP
4. **Micro-interactions** améliorées
5. **Support RTL** pour l'internationalisation

### Nouvelles Fonctionnalités Design
- **Glassmorphisme** étendu aux modales
- **Neumorphisme** sur certains composants
- **Parallax subtile** sur les sections hero
- **Custom scrollbars** avec thématisation
- **Advanced hover states** avec clip-path

---

*Ce document de design constitue la référence officielle pour maintenir la cohérence visuelle et l'expérience utilisateur de l'application Japanese Custom GPT. Il doit être consulté lors de tout développement d'interface ou modification stylistique.*