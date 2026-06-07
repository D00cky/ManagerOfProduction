# Example

Demo OS records used by the Render/free-tier test deployment. `demo-os.xlsx` can be uploaded on the Importar Excel page to simulate the import flow.

The same rows are seeded into SQLite on Render startup. Changes made in the app are stored in SQLite while the Render instance is running. When the demo database is reset on a new Render start, these example records are seeded again.
