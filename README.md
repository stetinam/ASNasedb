

copy database to /blast

BLAST Database error: No alias or index file found for protein database [swissprot.fasta] in search path [/blast::]
for f in *.fasta; do b=$(basename $f .fasta); makeblastdb -in $f -dbtype prot -out $b; done

