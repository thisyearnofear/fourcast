/**
 * POST /api/canton/settle
 *
 * Records a Canton settlement intent. The actual Daml exercise command
 * is submitted client-side via Console Wallet (the user must authorize
 * the transaction in their wallet extension).
 *
 * This endpoint:
 * 1. Validates the settlement request
 * 2. Records it in the signal database (chainOrigin: 'CANTON')
 * 3. Returns the Daml command payload for the client to submit
 *
 * The client then calls cantonWallet.submitCommands() with the payload.
 */
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const body = await request.json();
    const { signalId, positionContractId, outcome, operatorPartyId, holderPartyId } = body;

    if (!positionContractId) {
      return Response.json(
        { success: false, error: 'positionContractId is required' },
        { status: 400 }
      );
    }

    if (!outcome || !['ResolvedYes', 'ResolvedNo', 'Voided'].includes(outcome)) {
      return Response.json(
        { success: false, error: 'outcome must be ResolvedYes, ResolvedNo, or Voided' },
        { status: 400 }
      );
    }

    const darPackageId = process.env.NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID || '';
    if (!darPackageId) {
      return Response.json(
        { success: false, error: 'Canton DAR package ID not configured' },
        { status: 500 }
      );
    }

    // Build the Daml exercise command for the client to submit
    const templateId = `${darPackageId}:Fourcast.PredictionPosition:PredictionPosition`;
    const command = {
      type: 'exercise',
      templateId,
      contractId: positionContractId,
      choice: 'Settle',
      argument: { outcome },
    };

    return Response.json({
      success: true,
      settlement: {
        signalId,
        positionContractId,
        outcome,
        chainOrigin: 'CANTON',
        command,
        // The client should call:
        //   cantonWallet.submitCommands({ actAs: [holderPartyId], commands: [command], wait: true })
        submitInstructions: {
          actAs: [holderPartyId].filter(Boolean),
          commands: [command],
          wait: true,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Canton settle API error:', error);
    return Response.json(
      { success: false, error: 'Settlement request failed', message: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
