'use strict';

// Pages légales servies par le bot (adresses /terms et /privacy), en anglais puis en français.
// Mises à jour : changer UPDATED si le texte change.

const UPDATED = 'October 11, 2026';
const UPDATED_FR = '11 octobre 2026';

const termsBody = `
<h1>Terms of Service — Otaku Quote Automation</h1>
<p><em>Last updated: ${UPDATED}</em></p>

<h2>1. What this service is</h2>
<p>Otaku Quote Automation is a small web application that creates anime-inspired quote images with captions
and, when the account owner explicitly connects a TikTok account, publishes these photo posts to that TikTok account
through the official TikTok Login Kit and Content Posting API.</p>

<h2>2. Using the service</h2>
<ul>
  <li>You may connect only a TikTok account that you own or are authorized to manage.</li>
  <li>Publishing is performed only after the account owner has authorized the application and confirmed the post.</li>
  <li>You must follow TikTok's Terms of Service and Community Guidelines. Do not use the service to post unlawful,
      misleading, hateful or infringing content.</li>
</ul>

<h2>3. Content</h2>
<p>The quotes are original sentences written in the spirit of anime characters. They are not official lines
from any anime, and the application is not affiliated with, endorsed by, or sponsored by any anime studio,
rights holder or by TikTok. All character names and anime titles belong to their respective owners.</p>

<h2>4. Disconnecting</h2>
<p>You can disconnect your TikTok account at any time from the home page of this site, or by removing the app in
TikTok (Settings and privacy, Security and permissions, Apps and services). Disconnecting stops all publishing.</p>

<h2>5. No warranty</h2>
<p>The service is provided "as is", without warranty of any kind. Availability may change, and publishing depends
on TikTok's own services and rules. To the extent permitted by law, the operator is not liable for indirect damages
resulting from the use of the service.</p>

<h2>6. Changes</h2>
<p>These terms may be updated. The date above shows the latest version. Continuing to use the service after a change
means you accept the updated terms.</p>

<h2>7. Contact</h2>
<p>Questions about these terms can be sent through the TikTok account that operates this application.</p>

<hr>

<h1>Conditions d'utilisation (français)</h1>
<p><em>Dernière mise à jour : ${UPDATED_FR}</em></p>
<p><strong>Le service.</strong> Otaku Quote Automation crée des images de citations inspirées des animés, avec une légende,
et, lorsque le propriétaire du compte connecte explicitement son compte TikTok, publie ces photos sur ce compte via les outils
officiels de TikTok (Login Kit et Content Posting API).</p>
<p><strong>Utilisation.</strong> Vous ne pouvez connecter qu'un compte TikTok dont vous êtes propriétaire ou que vous
êtes autorisé à gérer. Une publication n'est effectuée qu'après autorisation de l'application et confirmation du post.
Respectez les conditions et les règles de la communauté de TikTok.</p>
<p><strong>Contenu.</strong> Les citations sont des phrases originales écrites dans l'esprit des personnages d'animés ;
ce ne sont pas des répliques officielles. L'application n'est affiliée ni à un studio, ni à un ayant droit, ni à TikTok.
Les noms de personnages et d'animés appartiennent à leurs propriétaires.</p>
<p><strong>Déconnexion.</strong> Vous pouvez déconnecter votre compte à tout moment depuis la page d'accueil du site ou en
retirant l'application dans les réglages de TikTok. Cela arrête toute publication.</p>
<p><strong>Garantie.</strong> Le service est fourni « tel quel », sans garantie. Sa disponibilité peut changer et la publication
dépend des services et des règles de TikTok.</p>
<p><strong>Contact.</strong> Pour toute question, utilisez le compte TikTok qui exploite cette application.</p>
`;

const privacyBody = `
<h1>Privacy Policy — Otaku Quote Automation</h1>
<p><em>Last updated: ${UPDATED}</em></p>

<h2>1. Summary</h2>
<p>Otaku Quote Automation only uses the minimum TikTok data needed to let you connect your account and publish
photo posts to it. We do not sell your data and we do not use it for advertising.</p>

<h2>2. Data we receive from TikTok</h2>
<p>When you connect your TikTok account through TikTok Login Kit, and only with your permission, the application receives:</p>
<ul>
  <li>your TikTok open ID, display name and profile picture URL (scope <code>user.info.basic</code>);</li>
  <li>an access token and a refresh token that allow the application to act on your behalf;</li>
  <li>the list of permissions (scopes) you granted, such as <code>video.publish</code>.</li>
</ul>

<h2>3. How we use it</h2>
<ul>
  <li>To show which account is connected.</li>
  <li>To publish, after your confirmation, the photo posts created by this application to your TikTok account
      (Content Posting API). The photo files are temporarily hosted on this site so TikTok can retrieve them.</li>
  <li>We do not read your videos, messages, followers or any other private data.</li>
</ul>

<h2>4. Storage and retention</h2>
<p>The tokens and profile details are stored on this application's server, on the hosting provider's infrastructure
(Railway), and are kept only until you disconnect your account or the tokens expire. Temporary photo files are deleted
automatically within a few hours. Standard technical server logs (such as IP address and requested page) may be kept
for a short period for security and debugging.</p>

<h2>5. Sharing</h2>
<p>We do not sell, rent or share your data with third parties, except with TikTok (to perform the actions you authorize)
and with the infrastructure providers needed to run this site.</p>

<h2>6. Your choices</h2>
<ul>
  <li><strong>Disconnect:</strong> use the "Disconnect" button on the home page. This revokes the token and deletes the stored data.</li>
  <li><strong>From TikTok:</strong> Settings and privacy, Security and permissions, Apps and services, then remove this application.</li>
</ul>

<h2>7. Children</h2>
<p>This service is not intended for people under 18 and we do not knowingly collect their data.</p>

<h2>8. Changes</h2>
<p>This policy may be updated; the date above shows the latest version.</p>

<h2>9. Contact</h2>
<p>Questions about this policy or requests to delete your data can be sent through the TikTok account that operates
this application. You can also delete your data yourself at any time with the "Disconnect" button.</p>

<hr>

<h1>Politique de confidentialité (français)</h1>
<p><em>Dernière mise à jour : ${UPDATED_FR}</em></p>
<p><strong>Résumé.</strong> L'application n'utilise que les données TikTok nécessaires pour connecter votre compte et y
publier des photos. Nous ne vendons pas vos données et ne les utilisons pas pour de la publicité.</p>
<p><strong>Données reçues.</strong> Avec votre autorisation : identifiant TikTok (open ID), nom affiché, photo de profil,
jeton d'accès et jeton de renouvellement, et la liste des permissions accordées.</p>
<p><strong>Utilisation.</strong> Afficher le compte connecté et publier, après votre confirmation, les photos créées par
l'application. Les photos sont hébergées temporairement sur ce site pour que TikTok puisse les récupérer. Nous ne lisons
ni vos vidéos, ni vos messages, ni vos abonnés.</p>
<p><strong>Conservation.</strong> Les jetons et informations de profil sont stockés sur le serveur de l'application (hébergeur
Railway) jusqu'à la déconnexion ou l'expiration des jetons. Les fichiers photo temporaires sont supprimés automatiquement
en quelques heures. Des journaux techniques standard peuvent être conservés brièvement.</p>
<p><strong>Partage.</strong> Aucune vente ni location de données ; partage uniquement avec TikTok (pour les actions que vous
autorisez) et avec les prestataires d'infrastructure nécessaires.</p>
<p><strong>Vos choix.</strong> Bouton « Disconnect » sur la page d'accueil (révoque le jeton et supprime les données), ou
retrait de l'application dans les réglages de TikTok (Paramètres et confidentialité, Sécurité et autorisations).</p>
<p><strong>Enfants.</strong> Service non destiné aux moins de 18 ans.</p>
<p><strong>Contact.</strong> Utilisez le compte TikTok qui exploite cette application, ou supprimez vous-même vos données avec le
bouton « Disconnect ».</p>
`;

module.exports = { termsBody, privacyBody };
