// 2026-09-26 (BR 1): pt-BR version of the privacy page — faithful translation of the English page; legal meaning unchanged. Rendered only on /pt.
import Breadcrumbs from '@/components/Breadcrumbs';
import { CONFIG } from '@/lib/utils';

export default function PrivacyPt() {
  return (
    <>
      <Breadcrumbs items={[{ label: 'Política de Privacidade' }]} />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Política de Privacidade</h1>
          <p className="text-gray-500 mb-8">Última atualização: maio de 2026</p>

          <div className="space-y-8 text-gray-600">
            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">1. Introdução</h2>
              <p className="leading-relaxed">
                Bem-vindo à Política de Privacidade do &quot;The Winners&quot; ({new URL(CONFIG.siteUrl).hostname}). Respeitamos a sua privacidade e temos o compromisso de proteger as suas informações pessoais.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">2. Informações que Coletamos</h2>
              <ul className="list-disc list-inside space-y-2 ms-4">
                <li><strong>Informações técnicas:</strong> endereço IP, tipo de navegador, dispositivo, sistema operacional.</li>
                <li><strong>Informações de uso:</strong> páginas visualizadas, links clicados.</li>
                <li><strong>Cookies:</strong> pequenos arquivos para melhorar a sua experiência.</li>
                <li><strong>Parâmetros de rastreamento:</strong> gclid e fbclid para rastrear as origens do tráfego.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">3. Uso das Informações</h2>
              <ul className="list-disc list-inside space-y-2 ms-4">
                <li>Melhoria da experiência do usuário</li>
                <li>Análise de tráfego</li>
                <li>Acompanhamento da eficácia do marketing</li>
                <li>Cálculo de comissões de afiliados</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">4. Cookies</h2>
              <p className="leading-relaxed">
                O site utiliza cookies essenciais, de análise (Google Analytics) e de marketing. Você pode gerenciar suas preferências nas configurações do seu navegador.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">5. Terceiros</h2>
              <p className="leading-relaxed">
                Podemos compartilhar informações com o Google Analytics, o Google Tag Manager, a Vercel (nosso provedor de hospedagem, com servidores de borda em todo o mundo), a Supabase (nosso provedor de banco de dados) e parceiros comerciais do Programa de Associados da Amazon em diversas lojas regionais da Amazon (amazon.ae, amazon.sa, amazon.com, amazon.co.uk, amazon.de, amazon.fr, amazon.it, amazon.es, amazon.ca, amazon.com.au, amazon.sg, amazon.com.br, amazon.pl, amazon.se, amazon.ie, amazon.com.be, amazon.nl). Não vendemos as suas informações pessoais.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">6. Segurança</h2>
              <p className="leading-relaxed">
                Adotamos medidas de segurança razoáveis para proteger as suas informações.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">7. Seus Direitos e Legislação Aplicável</h2>
              <p className="leading-relaxed mb-4">
                O Site é operado a partir dos Emirados Árabes Unidos e atende principalmente residentes dos Emirados Árabes Unidos, nos termos da Lei de Proteção de Dados Pessoais dos Emirados Árabes Unidos (PDPL). No entanto, visitantes de fora dos Emirados Árabes Unidos podem ter direitos adicionais previstos em suas leis locais, os quais respeitamos quando aplicáveis.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">Residentes dos Emirados Árabes Unidos (PDPL)</h3>
              <p className="leading-relaxed">
                Nos termos da PDPL, você tem o direito de solicitar o acesso, a correção ou a exclusão dos seus dados pessoais, bem como de retirar o seu consentimento.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">Espaço Econômico Europeu e Reino Unido (GDPR / UK GDPR)</h3>
              <p className="leading-relaxed mb-2">Se você estiver localizado no EEE ou no Reino Unido, você tem o direito de:</p>
              <ul className="list-disc list-inside space-y-1 ms-4">
                <li>acessar os dados pessoais que mantemos sobre você;</li>
                <li>solicitar a retificação ou o apagamento dos seus dados pessoais;</li>
                <li>restringir o tratamento ou se opor a ele;</li>
                <li>portabilidade dos dados;</li>
                <li>retirar o consentimento a qualquer momento (quando o tratamento for baseado no consentimento);</li>
                <li>apresentar uma reclamação à autoridade de controle local.</li>
              </ul>
              <p className="leading-relaxed mt-3">
                <strong>Base legal para o tratamento</strong> (Artigo 6 do GDPR): (a) o seu consentimento para cookies de análise e de marketing, que você pode retirar a qualquer momento nas configurações de cookies, e (b) o nosso interesse legítimo em operar o Site, mantê-lo seguro e melhorar a experiência do usuário.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">Residentes da Califórnia (CCPA / CPRA)</h3>
              <p className="leading-relaxed mb-2">Se você for residente da Califórnia, você tem o direito de:</p>
              <ul className="list-disc list-inside space-y-1 ms-4">
                <li>saber quais informações pessoais coletamos, vendemos ou compartilhamos;</li>
                <li>excluir as informações pessoais que mantemos sobre você;</li>
                <li>optar por não participar da &quot;venda&quot; ou do &quot;compartilhamento&quot; de informações pessoais (incluindo o uso de cookies de rastreamento de afiliados para publicidade em contexto cruzado);</li>
                <li>não sofrer discriminação por exercer esses direitos.</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">Retenção de dados</h3>
              <p className="leading-relaxed">
                Os dados de sessão e de rastreamento de cliques são retidos por até 24 meses para fins de análise e atribuição de afiliados; por mais tempo quando exigido para cumprimento de obrigações legais.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">Transferências internacionais de dados</h3>
              <p className="leading-relaxed">
                Os seus dados podem ser transferidos para países diferentes do seu e tratados neles, incluindo os Estados Unidos e a União Europeia, pelos nossos prestadores de serviços (Vercel, Supabase, Google, Amazon). Quando aplicável, essas transferências se baseiam em salvaguardas adequadas, como Cláusulas Contratuais Padrão ou mecanismos equivalentes.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">Como exercer os seus direitos</h3>
              <p className="leading-relaxed">
                Envie um e-mail para{' '}
                <a href="mailto:thewinners@atomicmail.io" className="text-blue-600 hover:underline">thewinners@atomicmail.io</a>
                . Responderemos em até 30 dias, conforme exigido pelo GDPR e pela CCPA. Inclua informações suficientes para que possamos verificar a sua identidade (por exemplo, datas aproximadas das visitas, país, navegador/dispositivo).
              </p>

              <p className="leading-relaxed mt-4 italic">
                Quando leis locais obrigatórias de proteção ao consumidor ou de proteção de dados entrarem em conflito com esta Política de Privacidade, prevalecerá a lei local obrigatória.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">8. Links Externos</h2>
              <p className="leading-relaxed">
                Nosso site contém links para sites externos (incluindo as diversas lojas regionais da Amazon com as quais temos parceria — amazon.ae, amazon.com, amazon.co.uk, amazon.de e outras, dependendo do seu país). Não somos responsáveis pelas práticas de privacidade desses sites; consulte diretamente as respectivas políticas de privacidade.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">9. Alterações nesta Política</h2>
              <p className="leading-relaxed">
                Podemos atualizar esta política periodicamente. As alterações serão publicadas nesta página.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">10. Contato</h2>
              <p className="leading-relaxed">
                Em caso de dúvidas sobre a nossa política de privacidade, entre em contato pelo e-mail{' '}
                <a href="mailto:thewinners@atomicmail.io" className="text-blue-600 hover:underline">thewinners@atomicmail.io</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
