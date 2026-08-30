import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", color: "#111827" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 32 },
  entreprise: { fontSize: 18, fontWeight: 700 },
  factureTitre: { fontSize: 20, fontWeight: 700, textAlign: "right" },
  numero: { fontSize: 10, color: "#6b7280", textAlign: "right", marginTop: 4 },
  section: { marginBottom: 24 },
  label: { fontSize: 9, color: "#6b7280", marginBottom: 2, textTransform: "uppercase" },
  table: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  row: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  colDesc: { flex: 4 },
  colQte: { flex: 1, textAlign: "right" },
  colPU: { flex: 1.5, textAlign: "right" },
  colTotal: { flex: 1.5, textAlign: "right" },
  headRow: { fontWeight: 700, color: "#6b7280", fontSize: 9, textTransform: "uppercase" },
  totalBox: { marginTop: 16, alignItems: "flex-end" },
  totalLigne: { flexDirection: "row", gap: 24, marginBottom: 4 },
  totalLabel: { fontSize: 11 },
  totalValeur: { fontSize: 14, fontWeight: 700 },
  footer: { position: "absolute", bottom: 40, left: 48, right: 48, fontSize: 9, color: "#9ca3af" },
});

export type FactureItemPdf = { description: string; quantite: number; prixUnitaire: number };

export type FacturePdfInput = {
  numero: string;
  dateEmission: Date;
  entreprise: { nom: string; adresse?: string; email?: string; siret?: string };
  client: { nom: string; adresse?: string; email?: string };
  items: FactureItemPdf[];
  montantTotal: number;
};

function FactureDocument({ numero, dateEmission, entreprise, client, items, montantTotal }: FacturePdfInput) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.entreprise}>{entreprise.nom}</Text>
            {entreprise.adresse && <Text>{entreprise.adresse}</Text>}
            {entreprise.email && <Text>{entreprise.email}</Text>}
            {entreprise.siret && <Text>SIRET: {entreprise.siret}</Text>}
          </View>
          <View>
            <Text style={styles.factureTitre}>FACTURE</Text>
            <Text style={styles.numero}>{numero}</Text>
            <Text style={styles.numero}>{dateEmission.toLocaleDateString("fr-FR")}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Facturé à</Text>
          <Text>{client.nom}</Text>
          {client.adresse && <Text>{client.adresse}</Text>}
          {client.email && <Text>{client.email}</Text>}
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headRow]}>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colQte}>Qté</Text>
            <Text style={styles.colPU}>Prix unitaire</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {items.map((item, i) => (
            <View style={styles.row} key={i}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQte}>{item.quantite}</Text>
              <Text style={styles.colPU}>{item.prixUnitaire.toFixed(2)} €</Text>
              <Text style={styles.colTotal}>{(item.quantite * item.prixUnitaire).toFixed(2)} €</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalBox}>
          <View style={styles.totalLigne}>
            <Text style={styles.totalLabel}>Total TTC</Text>
            <Text style={styles.totalValeur}>{montantTotal.toFixed(2)} €</Text>
          </View>
        </View>

        <Text style={styles.footer}>{entreprise.nom} — Facture générée automatiquement par NOTEO AI</Text>
      </Page>
    </Document>
  );
}

export async function genererFacturePdf(input: FacturePdfInput): Promise<Buffer> {
  return renderToBuffer(<FactureDocument {...input} />);
}
