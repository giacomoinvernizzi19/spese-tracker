import type { APIRoute } from 'astro';
import { getAuthUser } from '../../../lib/auth';
import { createNordigenClient, type Transaction } from '../../../lib/nordigen';
import { safeDecrypt } from '../../../lib/encryption';

export const prerender = false;

// Helper: suggerisce categoria basandosi su descrizione
async function suggestCategory(
  description: string,
  userId: string,
  db: D1Database
): Promise<number | null> {
  // Cerca transazioni simili e usa la loro categoria
  const similar = await db.prepare(`
    SELECT category_id, COUNT(*) as cnt
    FROM transactions
    WHERE user_id = ?
      AND category_id IS NOT NULL
      AND (
        LOWER(description) LIKE LOWER(?) OR
        LOWER(?) LIKE '%' || LOWER(description) || '%'
      )
    GROUP BY category_id
    ORDER BY cnt DESC
    LIMIT 1
  `).bind(userId, `%${description.slice(0, 20)}%`, description).first();

  return similar?.category_id as number | null;
}

// POST - Sincronizza transazioni da una connessione bancaria
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const runtime = locals.runtime;
  const db = runtime.env.DB;

  // Auth check
  const user = await getAuthUser(cookies, db);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Non autenticato' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { connection_id, date_from, date_to } = body;

    // Get connection(s) to sync
    let connections: any[];
    if (connection_id) {
      const conn = await db.prepare(`
        SELECT * FROM bank_connections
        WHERE id = ? AND user_id = ? AND status = 'linked'
      `).bind(connection_id, user.id).first();

      if (!conn) {
        return new Response(JSON.stringify({ error: 'Connessione non trovata o non attiva' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      connections = [conn];
    } else {
      // Sync all linked connections for this user
      const result = await db.prepare(`
        SELECT * FROM bank_connections
        WHERE user_id = ? AND status = 'linked'
      `).bind(user.id).all();
      connections = result.results;
    }

    if (connections.length === 0) {
      return new Response(JSON.stringify({
        synced: 0,
        new: 0,
        duplicates: 0,
        message: 'Nessun conto collegato da sincronizzare'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const client = createNordigenClient({
      NORDIGEN_SECRET_ID: runtime.env.NORDIGEN_SECRET_ID,
      NORDIGEN_SECRET_KEY: runtime.env.NORDIGEN_SECRET_KEY
    });

    const encryptionKey = runtime.env.ENCRYPTION_KEY as string;

    let totalNew = 0;
    let totalDuplicates = 0;
    let totalFetched = 0;
    let totalErrors = 0;
    const errors: string[] = [];
    const debug: any = {
      connectionsFound: connections.length,
      connections: [],
      accounts: [],
      transactions: []
    };

    for (const connection of connections) {
      try {
        // Decrypt account_ids if encrypted
        const rawAccountIds = connection.account_ids as string || '[]';
        const decryptedAccountIds = encryptionKey
          ? await safeDecrypt(rawAccountIds, encryptionKey)
          : rawAccountIds;
        const accountIds = JSON.parse(decryptedAccountIds);

        // Debug: log connection details
        debug.connections.push({
          id: connection.id,
          institution: connection.institution_name,
          status: connection.status,
          accountIdsRaw: connection.account_ids,
          accountIdsParsed: accountIds,
          accountCount: accountIds.length,
          lastSync: connection.last_sync_at
        });

        // Default: sync from last sync or last 90 days
        const syncFrom = date_from || (
          connection.last_sync_at
            ? new Date(connection.last_sync_at).toISOString().split('T')[0]
            : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        );

        for (const accountId of accountIds) {
          try {
            // Debug: log before API call
            const accountDebugEntry: any = {
              accountId: accountId.slice(0, 8) + '...',
              fullAccountId: accountId,
              dateFrom: syncFrom,
              dateTo: date_to || 'oggi',
              apiCallStatus: 'starting'
            };

            const response = await client.getTransactions(accountId, syncFrom, date_to);

            // Debug: log raw response structure
            accountDebugEntry.apiCallStatus = 'completed';
            accountDebugEntry.responseKeys = response ? Object.keys(response) : 'null response';
            accountDebugEntry.hasTransactions = !!response?.transactions;
            accountDebugEntry.rawResponse = JSON.stringify(response).slice(0, 500);

            const transactions = response.transactions?.booked || [];
            const pendingCount = response.transactions?.pending?.length || 0;

            // Debug info
            const accountDebug = {
              accountId: accountId.slice(0, 8) + '...',
              dateFrom: syncFrom,
              dateTo: date_to || 'oggi',
              fetchedBooked: transactions.length,
              fetchedPending: pendingCount,
              dateRange: transactions.length > 0 ? {
                oldest: transactions[transactions.length - 1]?.bookingDate,
                newest: transactions[0]?.bookingDate
              } : null
            };
            debug.accounts.push(accountDebug);
            totalFetched += transactions.length;

            for (let txIndex = 0; txIndex < transactions.length; txIndex++) {
              const tx = transactions[txIndex];
              const txDebug: any = {
                index: txIndex,
                date: tx.bookingDate || tx.valueDate,
                amount: tx.transactionAmount?.amount,
                currency: tx.transactionAmount?.currency,
                desc: (tx.remittanceInformationUnstructured || tx.creditorName || tx.debtorName || '').slice(0, 50),
                hasTransactionId: !!tx.transactionId,
                hasInternalId: !!tx.internalTransactionId,
                status: 'unknown'
              };

              try {
                const externalId = `${accountId}_${tx.transactionId || tx.internalTransactionId || crypto.randomUUID()}`;
                txDebug.externalId = externalId;

                // Check if already exists (dedupe)
                const existing = await db.prepare(`
                  SELECT id FROM transactions WHERE user_id = ? AND external_id = ?
                `).bind(user.id, externalId).first();

                if (existing) {
                  totalDuplicates++;
                  txDebug.status = 'duplicate';
                  debug.transactions.push(txDebug);
                  continue;
                }

                // Parse amount and determine type
                const amount = Math.abs(parseFloat(tx.transactionAmount.amount));
                const type = parseFloat(tx.transactionAmount.amount) < 0 ? 'expense' : 'income';

                // Build description from available fields
                const description = tx.remittanceInformationUnstructured
                  || tx.creditorName
                  || tx.debtorName
                  || 'Transazione bancaria';

                // Try to auto-categorize
                const categoryId = await suggestCategory(description, user.id, db);

                // Get transaction date
                const txDate = tx.bookingDate || tx.valueDate || new Date().toISOString().split('T')[0];

                // Insert transaction
                await db.prepare(`
                  INSERT INTO transactions (user_id, amount, type, description, date, source, external_id, bank_connection_id, category_id)
                  VALUES (?, ?, ?, ?, ?, 'bank', ?, ?, ?)
                `).bind(
                  user.id,
                  amount,
                  type,
                  description,
                  txDate,
                  externalId,
                  connection.id,
                  categoryId
                ).run();

                totalNew++;
                txDebug.status = 'inserted';
              } catch (txError) {
                totalErrors++;
                txDebug.status = 'error';
                txDebug.error = txError instanceof Error ? txError.message : 'unknown';
              }
              debug.transactions.push(txDebug);
            }
          } catch (accountError) {
            console.error(`Error syncing account ${accountId}:`, accountError);
            errors.push(`Account ${accountId.slice(0, 8)}...: ${accountError instanceof Error ? accountError.message : 'unknown'}`);
            // Debug: log failed account
            debug.accounts.push({
              accountId: accountId.slice(0, 8) + '...',
              fullAccountId: accountId,
              apiCallStatus: 'error',
              error: accountError instanceof Error ? accountError.message : String(accountError),
              errorStack: accountError instanceof Error ? accountError.stack?.slice(0, 300) : undefined
            });
          }
        }

        // Update last sync timestamp
        await db.prepare(`
          UPDATE bank_connections SET last_sync_at = CURRENT_TIMESTAMP WHERE id = ?
        `).bind(connection.id).run();
      } catch (connError) {
        console.error(`Error syncing connection ${connection.id}:`, connError);
        errors.push(`Connection ${connection.institution_name || connection.id}: ${connError instanceof Error ? connError.message : 'unknown'}`);
      }
    }

    return new Response(JSON.stringify({
      synced: totalNew + totalDuplicates,
      fetched: totalFetched,
      new: totalNew,
      duplicates: totalDuplicates,
      insertErrors: totalErrors,
      errors: errors.length > 0 ? errors : undefined,
      debug
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Bank sync error:', error);
    return new Response(JSON.stringify({
      error: 'Errore nella sincronizzazione',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
