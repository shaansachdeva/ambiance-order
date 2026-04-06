import { prisma } from "../src/lib/prisma";

async function run() {
  const orders = await prisma.order.findMany({
    include: { items: true },
    orderBy: { orderId: "asc" },
  });

  let createdCount = 0;
  let syncedCount = 0;

  for (const order of orders) {
    // Step 1: If order has NO items, create one from the legacy single-item data
    if (order.items.length === 0) {
      console.log(`${order.orderId}: Creating missing OrderItem from legacy data...`);
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productCategory: order.productCategory,
          productDetails: order.productDetails,
          status: order.status,
          productionStages: order.productionStages,
        },
      });
      createdCount++;
    }

    // Step 2: Sync Order.status to the most advanced item status
    const allItems = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      select: { status: true },
    });

    if (allItems.length > 0) {
      const STATUS_PRIORITY = [
        "ORDER_PLACED",
        "CONFIRMED",
        "RAW_MATERIAL_NA",
        "IN_PRODUCTION",
        "READY_FOR_DISPATCH",
        "DISPATCHED",
      ];
      const mostAdvanced = allItems.reduce((best, item) => {
        const itemIdx = STATUS_PRIORITY.indexOf(item.status);
        const bestIdx = STATUS_PRIORITY.indexOf(best);
        return itemIdx > bestIdx ? item.status : best;
      }, "ORDER_PLACED");

      if (mostAdvanced !== order.status) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: mostAdvanced },
        });
        console.log(`${order.orderId}: Synced Order.status ${order.status} → ${mostAdvanced}`);
        syncedCount++;
      }
    }
  }

  console.log(`\nDone! Created ${createdCount} missing items, synced ${syncedCount} order statuses.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
