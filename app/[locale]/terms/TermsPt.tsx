// 2026-09-26 (BR 1): pt-BR version of the terms page — faithful translation of the English page; legal meaning unchanged. Rendered only on /pt.
import Breadcrumbs from '@/components/Breadcrumbs';
import { CONFIG } from '@/lib/utils';

export default function TermsPt() {
  return (
    <>
      <Breadcrumbs items={[{ label: 'Termos de Uso' }]} />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Termos de Uso</h1>
          <p className="text-gray-500 mb-8">Última atualização: setembro de 2026</p>

          <div className="space-y-8 text-gray-600">
            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">1. Aceitação dos Termos</h2>
              <p className="leading-relaxed">
                Ao acessar e utilizar o site &quot;The Winners&quot; ({new URL(CONFIG.siteUrl).hostname}), você concorda com estes termos de uso. Caso não concorde, por favor, abstenha-se de utilizar o site.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">2. Descrição do Serviço</h2>
              <p className="leading-relaxed">
                O site fornece informações e comparações entre diversos produtos. As informações têm como objetivo ajudar você a tomar decisões de compra bem fundamentadas.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">3. Limitação de Responsabilidade</h2>
              <p className="leading-relaxed">
                As informações são fornecidas &quot;no estado em que se encontram&quot;. Não garantimos a sua total exatidão. Preços e disponibilidade podem mudar — verifique no site do varejista antes de comprar.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">4. Links de Afiliados e Parcerias</h2>
              <p className="leading-relaxed mb-3">
                <strong>Divulgação de afiliados</strong> (conforme as orientações da FTC dos EUA §255, da CMA do Reino Unido, da UCPD da UE e do CONAR no Brasil):
              </p>
              <p className="leading-relaxed mb-3">
                O Site contém links de afiliados do Programa de Associados da Amazon, incluindo as lojas regionais da Amazon amazon.ae, amazon.sa, amazon.com, amazon.co.uk, amazon.de, amazon.fr, amazon.it, amazon.es, amazon.ca, amazon.com.au, amazon.sg, amazon.com.br, amazon.pl, amazon.se, amazon.ie, amazon.com.be e amazon.nl. A loja específica para a qual você é direcionado é determinada automaticamente com base no seu país.
              </p>
              <p className="leading-relaxed mb-3">
                Quando você clica em um link de afiliado e faz uma compra qualificada, podemos receber uma comissão, sem nenhum custo adicional para você. <strong>Como Associados da Amazon, ganhamos com compras qualificadas.</strong>
              </p>
              <p className="leading-relaxed">
                O recebimento de comissões não influencia as nossas recomendações editoriais nem a classificação dos produtos. Os produtos são selecionados com base em critérios orientados por dados, e não nas taxas de comissão.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">5. Propriedade Intelectual</h2>
              <p className="leading-relaxed">
                Todo o conteúdo do site é de propriedade do The Winners. É proibida a cópia ou distribuição sem permissão por escrito.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">6. Uso Proibido</h2>
              <ul className="list-disc list-inside space-y-2 ms-4">
                <li>Atividades ilegais</li>
                <li>Extração automatizada de dados (Web Scraping)</li>
                <li>Tentativas de violar a segurança</li>
                <li>Uso que prejudique o funcionamento normal do site</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">7. Legislação Aplicável</h2>
              <p className="leading-relaxed mb-3">
                Estes termos são regidos pelas leis dos Emirados Árabes Unidos. Quaisquer disputas decorrentes do uso deste site estarão sujeitas à jurisdição exclusiva dos tribunais de Dubai, Emirados Árabes Unidos.
              </p>
              <p className="leading-relaxed italic">
                Nada nesta seção prevalecerá sobre os direitos obrigatórios de proteção ao consumidor que você possa ter nos termos das leis do seu país de residência. Visitantes na União Europeia, no Reino Unido, na Califórnia e em outras jurisdições com leis obrigatórias de proteção ao consumidor mantêm esses direitos, independentemente da cláusula de escolha de lei acima.
              </p>
              {/* 2026-09-26 (global legal coverage): foro do consumidor + Brasil citado expressamente. */}
              <p className="leading-relaxed italic mt-3">
                Se você for consumidor, também pode propor uma ação perante os tribunais do país onde mora sempre que a sua lei local lhe garantir esse direito — por exemplo, os consumidores no Brasil, nos termos do Código de Defesa do Consumidor (CDC, Lei nº 8.078/1990).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">8. Alterações nos Termos</h2>
              <p className="leading-relaxed">
                Podemos atualizar estes termos periodicamente. O uso continuado do site constitui aceitação dos termos atualizados.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">9. Contato</h2>
              <p className="leading-relaxed">
                Em caso de dúvidas sobre os nossos termos de uso, entre em contato pelo e-mail{' '}
                <a href="mailto:thewinners@atomicmail.io" className="text-blue-600 hover:underline">thewinners@atomicmail.io</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
