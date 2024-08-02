
const { ObjectId } = require('mongodb');


async function routes(fastify, options) {
  fastify.get('/plan/list', async (request, reply) => {
    const user = await fastify.getUser(request, reply);
    
    const plans = [
      {
          name: "お試しプラン",
          price: "無料",
          yearly:"無料",
          monthly:"無料",
          features: [
              "7日間無料",
              "1日10件までチャットできる",
              "フレンドを1人まで作成できる",
              "無料プロンプトを使用できる",
              "簡単なサポート対応"
          ]
      },
      {
          name: "プレミアムプラン",
          price: "￥1,200円/月",
          yearly:"￥12,000円/月",
          monthly:"￥1,200円/月",
          features: [
              "1日200件までチャットできる",
              "フレンドを3人まで作成できる",
              "無料プロンプトを使用できる",
              "新規機能のアクセス"
          ]
      },
      {
          name: "特別プラン",
          price: "￥3,000円/月",
          yearly:"30,000円/月",
          monthly:"￥3,000円/月",
          features: [
              "毎日無制限でチャットできる",
              "フレンドを無制限で作成できる",
              "無料プロンプトを使用できる",
              "新機能への早期アクセス",
              "優先的なサポート対応"
          ]
      }
  ];
    return reply.send( {plans} );
  });
}

  module.exports = routes;
  